// Builds the UI-format ("LiteGraph") workflow that ComfyUI embeds in saved PNGs.
//
// ComfyUI's SaveImage always writes the API-format graph as a "prompt" PNG chunk,
// but drag-and-drop into the ComfyUI editor loads the "workflow" chunk, which is
// only written when the client sends a UI-format graph in
// extra_data.extra_pnginfo.workflow. This app only builds API-format graphs, so
// we convert them here using each node's /object_info schema (needed to know
// which inputs are widgets vs. sockets and the order of widgets_values).

const WIDGET_TYPES = new Set(["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"]);
const NODE_WIDTH = 320;
const COLUMN_GAP = 80;
const ROW_GAP = 40;

// object_info per class_type, cached for the session per server
const objectInfoCache = new Map();

async function fetchObjectInfo(serverUrl, classType) {
  const key = `${serverUrl}|${classType}`;
  if (!objectInfoCache.has(key)) {
    const promise = fetch(`${serverUrl}/object_info/${encodeURIComponent(classType)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.[classType] ?? null)
      .catch(() => null);
    objectInfoCache.set(key, promise);
    // Don't cache failures — the server may just have been briefly unavailable
    promise.then((def) => { if (!def) objectInfoCache.delete(key); });
  }
  return objectInfoCache.get(key);
}

const isLink = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && Number.isInteger(v[1]);
const isWidgetSpec = (spec) => Array.isArray(spec?.[0]) || WIDGET_TYPES.has(spec?.[0]);

/** Ordered [name, spec] pairs for a node definition's required + optional inputs. */
function orderedInputs(def) {
  const entries = [];
  for (const section of ["required", "optional"]) {
    const specs = def.input?.[section] || {};
    const order = def.input_order?.[section] || Object.keys(specs);
    for (const name of order) if (specs[name]) entries.push([name, specs[name]]);
  }
  return entries;
}

function defaultWidgetValue(spec) {
  const [type, opts = {}] = spec;
  if (opts.default !== undefined) return opts.default;
  if (Array.isArray(type)) return type[0];
  if (type === "COMBO") return opts.options?.[0];
  return type === "STRING" ? "" : type === "BOOLEAN" ? false : 0;
}

/** Lay nodes out left-to-right by dependency depth so the graph is readable when loaded. */
function layoutPositions(apiPrompt, ids) {
  const depth = {};
  const visit = (id, stack = new Set()) => {
    if (depth[id] !== undefined) return depth[id];
    if (stack.has(id)) return 0;
    stack.add(id);
    let d = 0;
    for (const v of Object.values(apiPrompt[id].inputs || {})) {
      if (isLink(v) && apiPrompt[v[0]]) d = Math.max(d, visit(v[0], stack) + 1);
    }
    return (depth[id] = d);
  };
  ids.forEach((id) => visit(id));

  const rows = {};
  const pos = {};
  for (const id of ids) {
    const col = depth[id];
    rows[col] = rows[col] || 0;
    pos[id] = [col * (NODE_WIDTH + COLUMN_GAP), rows[col]];
    const inputCount = Object.keys(apiPrompt[id].inputs || {}).length;
    rows[col] += 60 + inputCount * 26 + ROW_GAP;
  }
  return pos;
}

/**
 * Convert an API-format prompt to a UI-format workflow. Returns null if any
 * node's schema is unavailable — callers should then just omit the workflow.
 */
export async function buildUiWorkflow(serverUrl, apiPrompt) {
  const ids = Object.keys(apiPrompt);
  const defs = await Promise.all(ids.map((id) => fetchObjectInfo(serverUrl, apiPrompt[id].class_type)));
  if (defs.some((d) => !d)) return null;
  const defById = Object.fromEntries(ids.map((id, i) => [id, defs[i]]));

  // UI node IDs must be numeric; our API graphs use IDs like "lora1_731"
  const numericId = {};
  let nextId = Math.max(0, ...ids.map(Number).filter(Number.isInteger)) + 1;
  for (const id of ids) numericId[id] = /^\d+$/.test(id) ? Number(id) : nextId++;

  const positions = layoutPositions(apiPrompt, ids);
  const links = [];
  const nodes = {};

  // First pass: node shells with outputs
  for (const id of ids) {
    const def = defById[id];
    const outputTypes = def.output || [];
    nodes[id] = {
      id: numericId[id],
      type: apiPrompt[id].class_type,
      pos: positions[id],
      size: [NODE_WIDTH, 60 + Object.keys(apiPrompt[id].inputs || {}).length * 26],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: outputTypes.map((type, slot) => ({
        name: def.output_name?.[slot] ?? (Array.isArray(type) ? "COMBO" : type),
        type: Array.isArray(type) ? "COMBO" : type,
        links: [],
      })),
      properties: { "Node name for S&R": apiPrompt[id].class_type },
      widgets_values: [],
      ...(apiPrompt[id]._meta?.title && apiPrompt[id]._meta.title !== def.display_name
        ? { title: apiPrompt[id]._meta.title } : {}),
    };
  }

  // Second pass: inputs, widget values, and links
  for (const id of ids) {
    const node = nodes[id];
    const values = apiPrompt[id].inputs || {};

    for (const [name, spec] of orderedInputs(defById[id])) {
      const value = values[name];
      const widget = isWidgetSpec(spec);
      const opts = spec[1] || {};

      if (isLink(value) && nodes[value[0]]) {
        const [srcId, srcSlot] = value;
        const linkId = links.length + 1;
        const type = nodes[srcId].outputs[srcSlot]?.type ?? (Array.isArray(spec[0]) ? "COMBO" : spec[0]);
        links.push([linkId, numericId[srcId], srcSlot, node.id, node.inputs.length, type]);
        nodes[srcId].outputs[srcSlot]?.links.push(linkId);
        node.inputs.push({ name, type, link: linkId, ...(widget ? { widget: { name } } : {}) });
        // A widget converted to an input still keeps its slot in widgets_values
        if (widget) node.widgets_values.push(defaultWidgetValue(spec));
      } else if (widget) {
        node.widgets_values.push(value !== undefined ? value : defaultWidgetValue(spec));
      } else {
        node.inputs.push({ name, type: spec[0], link: null });
      }

      if (widget) {
        // Extra frontend-only widgets that occupy a widgets_values slot
        if (opts.control_after_generate || (spec[0] === "INT" && (name === "seed" || name === "noise_seed"))) {
          node.widgets_values.push("fixed");
        }
        if (opts.image_upload) node.widgets_values.push("image");
      }
    }
  }

  // Execution order — sources first
  const sorted = [...ids].sort((a, b) => positions[a][0] - positions[b][0]);
  sorted.forEach((id, i) => { nodes[id].order = i; });

  return {
    last_node_id: Math.max(...Object.values(numericId)),
    last_link_id: links.length,
    nodes: ids.map((id) => nodes[id]),
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
  };
}
