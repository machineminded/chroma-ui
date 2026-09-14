// ComfyUI API layer — all communication with the ComfyUI backend

export async function queuePrompt(serverUrl, workflow) {
  const res = await fetch(`${serverUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`ComfyUI error: ${res.status}`);
  return res.json();
}

export async function getHistory(serverUrl, promptId) {
  const res = await fetch(`${serverUrl}/history/${promptId}`);
  return res.json();
}

export function getImageUrl(serverUrl, filename, subfolder, type) {
  const params = new URLSearchParams({
    filename,
    subfolder: subfolder || "",
    type: type || "output",
  });
  return `${serverUrl}/view?${params}`;
}

export async function fetchLoras(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/object_info/LoraLoaderModelOnly`);
    if (!res.ok) return [];
    const data = await res.json();
    const loraList = data?.LoraLoaderModelOnly?.input?.required?.lora_name?.[0];
    return Array.isArray(loraList) ? loraList : [];
  } catch {
    return [];
  }
}

/**
 * Upload an image to ComfyUI's /upload/image endpoint.
 * Returns { name, subfolder, type } on success.
 * For LoadImage node, use the name directly (ComfyUI resolves it from the input dir).
 */
export async function uploadImage(serverUrl, blob, filename = "chroma_input.png") {
  const form = new FormData();
  form.append("image", blob, filename);
  form.append("overwrite", "true");
  form.append("type", "input");
  const res = await fetch(`${serverUrl}/upload/image`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const result = await res.json();
  console.log("[Chroma] Upload response:", JSON.stringify(result));
  // Return the full reference path that LoadImage expects
  const fullName = result.subfolder ? `${result.subfolder}/${result.name}` : result.name;
  return { ...result, fullName };
}

/**
 * Upload a mask image to ComfyUI. Masks are stored alongside the original.
 */
export async function uploadMask(serverUrl, blob, originalFilename, maskFilename = "chroma_mask.png") {
  const form = new FormData();
  form.append("image", blob, maskFilename);
  form.append("original_ref", JSON.stringify({ filename: originalFilename }));
  form.append("overwrite", "true");
  const res = await fetch(`${serverUrl}/upload/image`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Mask upload failed: ${res.status}`);
  return res.json();
}

/**
 * Interrupt the currently running ComfyUI workflow.
 */
export async function interruptExecution(serverUrl) {
  try {
    await fetch(`${serverUrl}/interrupt`, { method: "POST" });
  } catch {
    // Best-effort — ignore network errors
  }
}

/**
 * Poll /history/{promptId} until outputs appear.
 * Calls onProgress(0-100) during polling and returns the outputs object.
 * Pass an AbortSignal via `signal` to cancel polling (e.g. when the user
 * clicks Cancel). Also detects execution_interrupted from ComfyUI itself
 * so external cancellations (via ComfyUI's own UI) recover cleanly.
 */
export async function pollForCompletion(serverUrl, promptId, { steps = 8, maxAttempts = 300, onProgress, signal } = {}) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
    onProgress?.(Math.min(95, (attempts / (steps * 1.2)) * 100));

    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    try {
      const history = await getHistory(serverUrl, promptId);
      const entry = history[promptId];
      if (entry) {
        const messages = entry.status?.messages ?? [];

        // Detect external cancellation (interrupted from ComfyUI or by our interrupt call)
        if (messages.some((m) => m[0] === "execution_interrupted")) {
          throw new DOMException("Cancelled", "AbortError");
        }

        // Detect execution errors
        if (entry.status?.status_str === "error") {
          const errMsg = messages.find((m) => m[0] === "execution_error");
          if (errMsg) {
            console.error("[Chroma] Execution error:", JSON.stringify(errMsg[1]));
            throw new Error(`ComfyUI execution error on node ${errMsg[1]?.node_id}: ${errMsg[1]?.exception_type} — ${errMsg[1]?.exception_message}`);
          }
        }

        if (entry.outputs && Object.keys(entry.outputs).length > 0) {
          onProgress?.(100);
          console.log("[Chroma] Poll complete. Output nodes:", Object.keys(entry.outputs));
          return entry.outputs;
        }
      }
    } catch (e) {
      if (e.name === "AbortError" || e.message?.includes("ComfyUI execution error")) throw e;
      // Keep polling through transient network blips
    }
  }
  throw new Error("Generation timed out");
}

/**
 * Find the first image in an outputs object, optionally from a specific node.
 * @param skipNodes - array of node IDs to skip in fallback search
 */
export function findOutputImage(outputs, preferredNodeId, skipNodes = []) {
  if (preferredNodeId && outputs[preferredNodeId]?.images?.[0]) {
    return outputs[preferredNodeId].images[0];
  }
  for (const nodeId of Object.keys(outputs)) {
    if (skipNodes.includes(nodeId)) continue;
    if (outputs[nodeId].images?.[0]) {
      return outputs[nodeId].images[0];
    }
  }
  return null;
}

/**
 * Fetch available UNET, CLIP, and VAE model lists from ComfyUI.
 */
export async function fetchModels(serverUrl) {
  async function getList(node, field) {
    try {
      const res = await fetch(`${serverUrl}/object_info/${node}`);
      if (!res.ok) return [];
      const data = await res.json();
      const list = data?.[node]?.input?.required?.[field]?.[0];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  const [unets, clips, vaes] = await Promise.all([
    getList("UNETLoader", "unet_name"),
    getList("CLIPLoader", "clip_name"),
    getList("VAELoader", "vae_name"),
  ]);
  return { unets, clips, vaes };
}

/**
 * Fetch available upscale models from ComfyUI.
 */
export async function fetchUpscaleModels(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/object_info/UpscaleModelLoader`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.UpscaleModelLoader?.input?.required?.model_name?.[0];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
