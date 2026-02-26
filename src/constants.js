export const COMFYUI_DEFAULT = "http://127.0.0.1:8188";

export const CANVAS_SIZES = [
  { label: "512 × 512", w: 512, h: 512 },
  { label: "768 × 768", w: 768, h: 768 },
  { label: "1024 × 1024", w: 1024, h: 1024 },
  { label: "768 × 1024", w: 768, h: 1024 },
  { label: "1024 × 768", w: 1024, h: 768 },
  { label: "1024 × 1536", w: 1024, h: 1536 },
  { label: "1536 × 1024", w: 1536, h: 1024 },
  { label: "1280 × 720", w: 1280, h: 720 },
  { label: "1344 × 768", w: 1344, h: 768 },
];

export const DEFAULT_CANVAS_INDEX = 5; // 1024×1536

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
