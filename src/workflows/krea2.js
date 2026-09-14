// Krea2 model family — workflow graphs, defaults, and metadata.
//
// Adapted from the reference ComfyUI exports "krea2 int8 convrot.json" (txt2img)
// and "krea inpainting.json" (inpaint) in the repo root, with two deliberate
// simplifications vs. those exports:
//  - Plain CLIPTextEncode for the negative prompt (no ApplyKrea2NegPiP custom node,
//    so this app doesn't require an extra ComfyUI custom-node install).
//  - No UltimateSDUpscale pass — Krea2 generates cleanly at native high resolutions,
//    so upscale is intentionally unsupported (see canvasSizes / supportsUpscale below).
import { buildLoraChain } from "./loraChain";
import { KREA2_CANVAS_SIZES, KREA2_DEFAULT_CANVAS_INDEX, KREA2_DEFAULTS } from "../constants";

function julianDayNumber() {
  return Math.floor(Date.now() / 86400000) + 2440588;
}

/**
 * Build txt2img workflow. Krea2's graph has no flow-shift node — the (possibly
 * LoRA-chained) UNET model feeds directly into KSampler.
 */
function buildTxt2ImgWorkflow({
  positive, negative, width, height, seed, steps, cfg,
  unetName, clipName, vaeName,
  loras,
}) {
  const { topModelRef, nodes: loraNodes } = buildLoraChain(loras, "731");

  return {
    "710": {
      class_type: "VAELoader",
      inputs: { vae_name: vaeName || "wan_2.1_vae.safetensors" },
      _meta: { title: "Load VAE" },
    },
    "731": {
      class_type: "UNETLoader",
      inputs: { unet_name: unetName || "Krea2_Turbo_convrot_int8mixed-extra.safetensors", weight_dtype: "default" },
      _meta: { title: "Load Diffusion Model" },
    },
    "733": {
      class_type: "CLIPLoader",
      inputs: { clip_name: clipName || "qwen3vl_4b_fp8_scaled.safetensors", type: "krea2", device: "default" },
      _meta: { title: "Load CLIP" },
    },
    "737": {
      class_type: "EmptySD3LatentImage",
      inputs: { width, height, batch_size: 1 },
      _meta: { title: "EmptySD3LatentImage" },
    },
    "748": {
      class_type: "CLIPTextEncode",
      inputs: { text: positive || "", clip: ["733", 0] },
      _meta: { title: "CLIP Text Encode (Positive Prompt)" },
    },
    "749": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative || "", clip: ["733", 0] },
      _meta: { title: "CLIP Text Encode (Negative Prompt)" },
    },
    "747": {
      class_type: "KSampler",
      inputs: {
        seed, steps: steps || 8, cfg: cfg || 1,
        sampler_name: "er_sde", scheduler: "simple", denoise: 1,
        model: topModelRef,
        positive: ["748", 0], negative: ["749", 0], latent_image: ["737", 0],
      },
      _meta: { title: "KSampler" },
    },
    "298": {
      class_type: "VAEDecode",
      inputs: { samples: ["747", 0], vae: ["710", 0] },
      _meta: { title: "VAE Decode" },
    },
    "740": {
      class_type: "SaveImage",
      inputs: { filename_prefix: `${julianDayNumber()}`, images: ["298", 0] },
      _meta: { title: "Save Image" },
    },
    ...loraNodes,
  };
}

/**
 * Build inpaint workflow, mirroring Chroma's InpaintCropImproved/Stitch shape.
 *
 * Node 38 = "Preview Context Image" (partial execution target).
 * Node 7  = "Save Image (Result)" (final stitched result).
 */
function buildInpaintWorkflow({
  imageName, maskName, positive, negative, seed, steps, cfg, denoise,
  unetName, clipName, vaeName,
  loras,
  contextExtendFactor, outputWidth, outputHeight,
  contextOnly = false,
}) {
  const { topModelRef, nodes: loraNodes } = buildLoraChain(loras, "731");

  const workflow = {
    "3": {
      class_type: "LoadImage",
      inputs: { image: imageName },
      _meta: { title: "Load Image" },
    },
    "50": {
      class_type: "LoadImageMask",
      inputs: { image: maskName, channel: "red" },
      _meta: { title: "Load Mask" },
    },
    "11": {
      class_type: "CLIPTextEncode",
      inputs: { text: positive || "", clip: ["733", 0] },
      _meta: { title: "CLIP Text Encode (Prompt) - Positive" },
    },
    "12": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative || "", clip: ["733", 0] },
      _meta: { title: "CLIP Text Encode (Prompt) - Negative" },
    },
    "14": {
      class_type: "KSampler",
      inputs: {
        seed, steps: steps || 8, cfg: cfg || 1,
        sampler_name: "euler", scheduler: "beta",
        denoise: denoise ?? 0.35,
        model: topModelRef,
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
        context_from_mask_extend_factor: contextExtendFactor ?? 2,
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
    "731": {
      class_type: "UNETLoader",
      inputs: { unet_name: unetName || "Krea2_Turbo_convrot_int8mixed-extra.safetensors", weight_dtype: "default" },
      _meta: { title: "Load Diffusion Model" },
    },
    "710": {
      class_type: "VAELoader",
      inputs: { vae_name: vaeName || "wan_2.1_vae.safetensors" },
      _meta: { title: "Load VAE" },
    },
    "733": {
      class_type: "CLIPLoader",
      inputs: { clip_name: clipName || "qwen3vl_4b_fp8_scaled.safetensors", type: "krea2", device: "default" },
      _meta: { title: "Load CLIP" },
    },
    "38": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "Krea2Ctx", images: ["25", 1] },
      _meta: { title: "Preview Context Image" },
    },
    ...loraNodes,
  };

  if (contextOnly) {
    delete workflow["14"]; // KSampler
    delete workflow["15"]; // VAEDecode
    delete workflow["19"]; // InpaintModelConditioning
    delete workflow["26"]; // InpaintStitch
    delete workflow["11"]; // CLIP pos
    delete workflow["12"]; // CLIP neg
    delete workflow["731"]; // UNET
    delete workflow["733"]; // CLIP loader
    Object.keys(loraNodes).forEach((k) => delete workflow[k]);
  } else {
    workflow["7"] = {
      class_type: "SaveImage",
      inputs: { filename_prefix: `${julianDayNumber()}_inpaint`, images: ["26", 0] },
      _meta: { title: "Save Image (Result)" },
    };
  }

  return workflow;
}

const krea2 = {
  id: "krea2",
  label: "Krea2",
  loraSlots: 6,
  supportsUpscale: false,
  canvasSizes: KREA2_CANVAS_SIZES,
  defaultCanvasIndex: KREA2_DEFAULT_CANVAS_INDEX,
  defaults: KREA2_DEFAULTS,
  outputNodes: {
    txt2img: { node: "740" },
    inpaint: { node: "7", contextNode: "38", skip: ["38"] },
  },
  buildTxt2Img: buildTxt2ImgWorkflow,
  buildInpaint: buildInpaintWorkflow,
};

export default krea2;
