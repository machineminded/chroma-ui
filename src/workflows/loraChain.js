// Shared N-slot LoRA chain builder used by every model family's workflow builders.

/**
 * Chain any number of LoRAs (LoraLoaderModelOnly nodes) onto a base model node.
 * @param loraList - [{ name, strength }, ...] — entries with name "(none)" or falsy are skipped
 * @param baseModelNode - node ID the first LoRA (or, if none, the caller) should read MODEL from
 * @returns { topModelRef: [nodeId, 0], nodes: { [nodeId]: node } }
 */
export function buildLoraChain(loraList, baseModelNode) {
  const active = (loraList || []).filter((l) => l && l.name && l.name !== "(none)");

  const nodes = {};
  let currentRef = [baseModelNode, 0];

  active.forEach((lora, i) => {
    const nodeId = `lora${i + 1}_${baseModelNode}`;
    nodes[nodeId] = {
      class_type: "LoraLoaderModelOnly",
      inputs: { lora_name: lora.name, strength_model: lora.strength ?? 1, model: currentRef },
      _meta: { title: `Load LoRA ${i + 1}` },
    };
    currentRef = [nodeId, 0];
  });

  return { topModelRef: currentRef, nodes };
}
