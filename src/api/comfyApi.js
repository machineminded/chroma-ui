// ComfyUI API layer — all communication with the ComfyUI backend

function julianDayNumber() {
  // Unix epoch (Jan 1, 1970) = JDN 2440588
  return Math.floor(Date.now() / 86400000) + 2440588;
}

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
 * Poll /history/{promptId} until outputs appear.
 * Calls onProgress(0-100) during polling and returns the outputs object.
 */
export async function pollForCompletion(serverUrl, promptId, { steps = 8, maxAttempts = 300, onProgress } = {}) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
    onProgress?.(Math.min(95, (attempts / (steps * 1.2)) * 100));

    try {
      const history = await getHistory(serverUrl, promptId);
      const entry = history[promptId];
      if (entry) {
        // Check for execution errors
        if (entry.status?.status_str === "error" || entry.status?.completed === false) {
          const errMsg = entry.status?.messages?.find(m => m[0] === "execution_error");
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
      if (e.message.includes("ComfyUI execution error")) throw e;
      // Keep polling for other errors (network blips)
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

// ---------------------------------------------------------------------------
// Workflow builders
// ---------------------------------------------------------------------------

function buildLoraChain(lora1, lora1Strength, lora2, lora2Strength, baseModelNode = "731") {
  const hasLora1 = lora1 && lora1 !== "(none)";
  const hasLora2 = lora2 && lora2 !== "(none)";

  let topModelRef; // what feeds into FlowShift
  if (hasLora2) topModelRef = ["753", 0];
  else if (hasLora1) topModelRef = ["757", 0];
  else topModelRef = [baseModelNode, 0];

  const lora2ModelInput = hasLora1 ? ["757", 0] : [baseModelNode, 0];

  const nodes = {};
  if (hasLora1) {
    nodes["757"] = {
      class_type: "LoraLoaderModelOnly",
      inputs: { lora_name: lora1, strength_model: lora1Strength ?? 1, model: [baseModelNode, 0] },
      _meta: { title: "Load LoRA 1" },
    };
  }
  if (hasLora2) {
    nodes["753"] = {
      class_type: "LoraLoaderModelOnly",
      inputs: { lora_name: lora2, strength_model: lora2Strength ?? 1, model: lora2ModelInput },
      _meta: { title: "Load LoRA 2" },
    };
  }

  return { topModelRef, nodes };
}

/**
 * Build txt2img workflow (Chroma default with SamplerCustomAdvanced + BetaSamplingScheduler).
 */
export function buildTxt2ImgWorkflow({
  positive, negative, width, height, seed, steps, cfg, shift,
  unetName, clipName, vaeName,
  lora1, lora1Strength, lora2, lora2Strength,
  betaAlpha, betaBeta,
}) {
  const { topModelRef, nodes: loraNodes } = buildLoraChain(lora1, lora1Strength, lora2, lora2Strength, "731");

  const workflow = {
    "298": {
      class_type: "VAEDecode",
      inputs: { samples: ["747", 0], vae: ["710", 0] },
      _meta: { title: "VAE Decode" },
    },
    "694": {
      class_type: "CFGGuider",
      inputs: { cfg: cfg || 1, model: ["701", 0], positive: ["748", 0], negative: ["749", 0] },
      _meta: { title: "CFGGuider" },
    },
    "700": {
      class_type: "KSamplerSelect",
      inputs: { sampler_name: "euler" },
      _meta: { title: "KSamplerSelect" },
    },
    "701": {
      class_type: "ModelSamplingAuraFlow",
      inputs: { shift: shift || 1, model: topModelRef },
      _meta: { title: "Flow Shift" },
    },
    "710": {
      class_type: "VAELoader",
      inputs: { vae_name: vaeName || "ae.safetensors" },
      _meta: { title: "Load VAE" },
    },
    "718": {
      class_type: "RandomNoise",
      inputs: { noise_seed: seed },
      _meta: { title: "SEED" },
    },
    "731": {
      class_type: "UNETLoader",
      inputs: { unet_name: unetName || "Chroma1-HD-Flash.safetensors", weight_dtype: "default" },
      _meta: { title: "Load Diffusion Model" },
    },
    "733": {
      class_type: "CLIPLoader",
      inputs: { clip_name: clipName || "t5xxl_fp8_e4m3fn_scaled.safetensors", type: "chroma", device: "default" },
      _meta: { title: "Load CLIP" },
    },
    "737": {
      class_type: "EmptySD3LatentImage",
      inputs: { width, height, batch_size: 1 },
      _meta: { title: "EmptySD3LatentImage" },
    },
    "740": {
      class_type: "SaveImage",
      inputs: { filename_prefix: `${julianDayNumber()}`, images: ["298", 0] },
      _meta: { title: "Save Image" },
    },
    "741": {
      class_type: "T5TokenizerOptions",
      inputs: { min_padding: 1, min_length: 0, clip: ["733", 0] },
      _meta: { title: "T5TokenizerOptions" },
    },
    "747": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["718", 0], guider: ["694", 0], sampler: ["700", 0],
        sigmas: ["751", 0], latent_image: ["737", 0],
      },
      _meta: { title: "SamplerCustomAdvanced" },
    },
    "748": {
      class_type: "CLIPTextEncode",
      inputs: { text: positive, clip: ["741", 0] },
      _meta: { title: "CLIP Text Encode (Positive Prompt)" },
    },
    "749": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative || "", clip: ["741", 0] },
      _meta: { title: "CLIP Text Encode (Negative Prompt)" },
    },
    "751": {
      class_type: "BetaSamplingScheduler",
      inputs: { steps: steps || 8, alpha: betaAlpha ?? 0.45, beta: betaBeta ?? 0.45, model: ["701", 0] },
      _meta: { title: "BetaSamplingScheduler" },
    },
    ...loraNodes,
  };

  return workflow;
}

/**
 * Build inpaint workflow (Chroma Flash inpainting).
 * Uses separate LoadImage (node 3) for the source image and
 * LoadImageMask (node 50) for the mask — avoids alpha-channel issues.
 *
 * Node 38 = "Preview Context Image" (partial execution target).
 * Node 7  = "Save Image (Result)" (final stitched result).
 *
 * @param imageName — filename of the source image (uploaded via /upload/image)
 * @param maskName  — filename of the mask image (uploaded via /upload/image)
 * @param contextOnly — if true, only execute up to the context preview (node 38)
 */
export function buildInpaintWorkflow({
  imageName, maskName, positive, negative, seed, steps, cfg, denoise, shift,
  unetName, clipName, vaeName,
  lora1, lora1Strength, lora2, lora2Strength,
  contextExtendFactor, outputWidth, outputHeight,
  contextOnly = false,
}) {
  // Use the SAME base node ID (731) as txt2img so ComfyUI caches are shared
  const { topModelRef, nodes: loraNodes } = buildLoraChain(lora1, lora1Strength, lora2, lora2Strength, "731");

  const workflow = {
    // Source image (RGB only, no alpha needed)
    "3": {
      class_type: "LoadImage",
      inputs: { image: imageName },
      _meta: { title: "Load Image" },
    },
    // Mask (white = inpaint area, loaded as a mask channel)
    "50": {
      class_type: "LoadImageMask",
      inputs: { image: maskName, channel: "red" },
      _meta: { title: "Load Mask" },
    },
    "11": {
      class_type: "CLIPTextEncode",
      inputs: { text: positive || "", clip: ["741", 0] },
      _meta: { title: "CLIP Text Encode (Prompt) - Positive" },
    },
    "12": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative || "ugly, text, watermark", clip: ["741", 0] },
      _meta: { title: "CLIP Text Encode (Prompt) - Negative" },
    },
    "14": {
      class_type: "KSampler",
      inputs: {
        seed: seed, steps: steps || 8, cfg: cfg || 1,
        sampler_name: "euler", scheduler: "beta",
        denoise: denoise ?? 0.5,
        model: ["36", 0],
        positive: ["19", 0], negative: ["19", 1], latent_image: ["19", 2],
      },
      _meta: { title: "KSampler" },
    },
    "15": {
      class_type: "VAEDecode",
      inputs: { samples: ["14", 0], vae: ["710", 0] },
      _meta: { title: "VAE Decode" },
    },
    "19": {
      class_type: "InpaintModelConditioning",
      inputs: {
        noise_mask: true,
        positive: ["11", 0], negative: ["12", 0],
        vae: ["710", 0], pixels: ["25", 1], mask: ["25", 2],
      },
      _meta: { title: "InpaintModelConditioning" },
    },
    "25": {
      class_type: "InpaintCropImproved",
      inputs: {
        downscale_algorithm: "bilinear", upscale_algorithm: "bicubic",
        preresize: false, preresize_mode: "ensure minimum resolution",
        preresize_min_width: 1024, preresize_min_height: 1024,
        preresize_max_width: 16384, preresize_max_height: 16384,
        mask_fill_holes: true, mask_expand_pixels: 0,
        mask_invert: false, mask_blend_pixels: 32,
        mask_hipass_filter: 0.1,
        extend_for_outpainting: false,
        extend_up_factor: 1, extend_down_factor: 1,
        extend_left_factor: 1, extend_right_factor: 1,
        context_from_mask_extend_factor: contextExtendFactor ?? 1,
        output_resize_to_target_size: true,
        output_target_width: 1024,
        output_target_height: 1024,
        output_padding: "32",
        image: ["3", 0],
        mask: ["50", 0],
      },
      _meta: { title: "Inpaint Crop (Improved)" },
    },
    "26": {
      class_type: "InpaintStitchImproved",
      inputs: { stitcher: ["25", 0], inpainted_image: ["15", 0] },
      _meta: { title: "Inpaint Stitch (Improved)" },
    },
    // === Shared node IDs with txt2img for VRAM cache reuse ===
    "731": {
      class_type: "UNETLoader",
      inputs: { unet_name: unetName || "Chroma1-HD-Flash.safetensors", weight_dtype: "default" },
      _meta: { title: "Load Diffusion Model" },
    },
    "710": {
      class_type: "VAELoader",
      inputs: { vae_name: vaeName || "ae.safetensors" },
      _meta: { title: "Load VAE" },
    },
    "733": {
      class_type: "CLIPLoader",
      inputs: { clip_name: clipName || "t5xxl_fp8_e4m3fn_scaled.safetensors", type: "chroma", device: "default" },
      _meta: { title: "Load CLIP" },
    },
    // FlowShift keeps its own ID (36) since shift value differs from txt2img (701)
    "36": {
      class_type: "ModelSamplingAuraFlow",
      inputs: { shift: shift ?? 3, model: topModelRef },
      _meta: { title: "Flow Shift" },
    },
    "741": {
      class_type: "T5TokenizerOptions",
      inputs: { min_padding: 1, min_length: 0, clip: ["733", 0] },
      _meta: { title: "T5TokenizerOptions" },
    },
    // Context preview — always included
    "38": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "ChromaCtx", images: ["25", 1] },
      _meta: { title: "Preview Context Image" },
    },
    ...loraNodes,
  };

  if (contextOnly) {
    // Remove generation nodes — only run up to InpaintCropImproved + preview
    delete workflow["14"]; // KSampler
    delete workflow["15"]; // VAEDecode
    delete workflow["19"]; // InpaintModelConditioning
    delete workflow["26"]; // InpaintStitch
    delete workflow["11"]; // CLIP pos
    delete workflow["12"]; // CLIP neg
    delete workflow["36"]; // FlowShift
    delete workflow["731"]; // UNET
    delete workflow["733"]; // CLIP loader
    delete workflow["741"]; // T5
    Object.keys(loraNodes).forEach((k) => delete workflow[k]);
  } else {
    // Full generation — add SaveImage for final stitched result
    workflow["7"] = {
      class_type: "SaveImage",
      inputs: { filename_prefix: `${julianDayNumber()}_inpaint`, images: ["26", 0] },
      _meta: { title: "Save Image (Result)" },
    };
  }

  return workflow;
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

/**
 * Build upscale workflow using UltimateSDUpscale.
 * Uses unified node IDs (731, 733, 710, 741) for VRAM cache sharing.
 */
export function buildUpscaleWorkflow({
  imageName, positive, negative, seed, steps, cfg, shift, denoise,
  unetName, clipName, vaeName,
  lora1, lora1Strength, lora2, lora2Strength,
  upscaleBy, tileWidth, tileHeight, upscaleModelName,
}) {
  const { topModelRef, nodes: loraNodes } = buildLoraChain(lora1, lora1Strength, lora2, lora2Strength, "731");

  return {
    "1": {
      class_type: "LoadImage",
      inputs: { image: imageName },
      _meta: { title: "Load Image" },
    },
    "2": {
      class_type: "UltimateSDUpscale",
      inputs: {
        upscale_by: upscaleBy ?? 2,
        seed, steps: steps || 8, cfg: cfg || 1,
        sampler_name: "euler", scheduler: "simple",
        denoise: denoise ?? 0.4,
        mode_type: "Linear",
        tile_width: tileWidth || 1024, tile_height: tileHeight || 1024,
        mask_blur: 16, tile_padding: 64,
        seam_fix_mode: "None", seam_fix_denoise: 1,
        seam_fix_width: 128, seam_fix_mask_blur: 32, seam_fix_padding: 32,
        force_uniform_tiles: true, tiled_decode: false,
        image: ["1", 0], model: ["701", 0],
        positive: ["748", 0], negative: ["749", 0],
        vae: ["710", 0], upscale_model: ["8", 0],
      },
      _meta: { title: "Ultimate SD Upscale" },
    },
    "8": {
      class_type: "UpscaleModelLoader",
      inputs: { model_name: upscaleModelName || "4x_NMKD-Siax_200k.pth" },
      _meta: { title: "Load Upscale Model" },
    },
    "740": {
      class_type: "SaveImage",
      inputs: { filename_prefix: `${julianDayNumber()}_upscaled`, images: ["2", 0] },
      _meta: { title: "Save Image" },
    },
    // === Shared model loaders (unified IDs for VRAM cache) ===
    "731": {
      class_type: "UNETLoader",
      inputs: { unet_name: unetName || "Chroma1-HD-Flash.safetensors", weight_dtype: "default" },
      _meta: { title: "Load Diffusion Model" },
    },
    "710": {
      class_type: "VAELoader",
      inputs: { vae_name: vaeName || "ae.safetensors" },
      _meta: { title: "Load VAE" },
    },
    "733": {
      class_type: "CLIPLoader",
      inputs: { clip_name: clipName || "t5xxl_fp8_e4m3fn_scaled.safetensors", type: "chroma", device: "default" },
      _meta: { title: "Load CLIP" },
    },
    "701": {
      class_type: "ModelSamplingAuraFlow",
      inputs: { shift: shift || 1, model: topModelRef },
      _meta: { title: "Flow Shift" },
    },
    "741": {
      class_type: "T5TokenizerOptions",
      inputs: { min_padding: 1, min_length: 0, clip: ["733", 0] },
      _meta: { title: "T5TokenizerOptions" },
    },
    "748": {
      class_type: "CLIPTextEncode",
      inputs: { text: positive || "", clip: ["741", 0] },
      _meta: { title: "CLIP Text Encode (Positive)" },
    },
    "749": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative || "", clip: ["741", 0] },
      _meta: { title: "CLIP Text Encode (Negative)" },
    },
    ...loraNodes,
  };
}
