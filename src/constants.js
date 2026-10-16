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

// Krea2's own native training resolution tops out around 1024px (~1MP); ComfyUI's
// official Krea-2 workflow documents support up to ~2MP ("2K"). Real-world testing
// found ~2-3MP gives noticeably better results without needing an upscale pass,
// so that's the top tier here rather than pushing further (the reference workflow's
// 4MP/9MP presets were untested extrapolations beyond the documented range).
export const KREA2_CANVAS_SIZES = [
  { label: "1024 × 1024 (~1MP)",             w: 1024, h: 1024 },
  { label: "832 × 1216 — Portrait (~1MP)",   w: 832,  h: 1216 },
  { label: "1216 × 832 — Landscape (~1MP)",  w: 1216, h: 832  },
  { label: "768 × 1344 — Portrait (~1MP)",   w: 768,  h: 1344 },
  { label: "1344 × 768 — Landscape (~1MP)",  w: 1344, h: 768  },
  { label: "1152 × 1728 — Portrait (~2MP)",  w: 1152, h: 1728 },
  { label: "1728 × 1152 — Landscape (~2MP)", w: 1728, h: 1152 },
  { label: "1088 × 1856 — Portrait (~2MP)",  w: 1088, h: 1856 },
  { label: "1856 × 1088 — Landscape (~2MP)", w: 1856, h: 1088 },
  { label: "1440 × 2080 — Portrait (~3MP)",  w: 1440, h: 2080 },
  { label: "2080 × 1440 — Landscape (~3MP)", w: 2080, h: 1440 },
  { label: "1312 × 2304 — Portrait (~3MP)",  w: 1312, h: 2304 },
  { label: "2304 × 1312 — Landscape (~3MP)", w: 2304, h: 1312 },
];

export const KREA2_DEFAULT_CANVAS_INDEX = 9; // 1440×2080 Portrait (~3MP sweet spot)

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

export const KREA2_DEFAULTS = {
  steps: 8,
  cfg: 1.0,
  unetName: "Krea2_Turbo_convrot_int8mixed-extra.safetensors",
  clipName: "qwen3vl_4b_fp8_scaled.safetensors",
  vaeName: "wan_2.1_vae.safetensors",
  inpaintDenoise: 0.35,
  inpaintContextExtend: 2.0,
  img2imgDenoise: 0.75,
  brushSize: 40,
};
