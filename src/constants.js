export const COMFYUI_DEFAULT = "http://127.0.0.1:8188";

export const CANVAS_SIZES = [
  { label: "1024 × 1024",           w: 1024, h: 1024 },
  { label: "896 × 1152 — Portrait",  w: 896,  h: 1152 },
  { label: "1152 × 896 — Landscape", w: 1152, h: 896  },
  { label: "832 × 1216 — Portrait",  w: 832,  h: 1216 },
  { label: "1216 × 832 — Landscape", w: 1216, h: 832  },
  { label: "768 × 1344 — Portrait",  w: 768,  h: 1344 },
  { label: "1344 × 768 — Landscape", w: 1344, h: 768  },
  { label: "1024 × 1536 — Portrait", w: 1024, h: 1536 },
  { label: "1536 × 1024 — Landscape",w: 1536, h: 1024 },
];

export const DEFAULT_CANVAS_INDEX = 7; // 1024×1536 Portrait

export const DEFAULTS = {
  steps: 8,
  cfg: 1.0,
  shift: 1.0,
  betaAlpha: 0.45,
  betaBeta: 0.45,
  unetName: "Chroma1-HD-Flash.safetensors",
  clipName: "t5xxl_fp8_e4m3fn_scaled.safetensors",
  vaeName: "ae.safetensors",
  inpaintDenoise: 0.5,
  inpaintContextExtend: 1.0,
  inpaintShift: 3.0,
  brushSize: 40,
  // Upscale
  upscaleBy: 2,
  upscaleTileWidth: 1024,
  upscaleTileHeight: 1024,
  upscaleDenoise: 0.4,
  upscaleModelName: "4x_NMKD-Siax_200k.pth",
};
