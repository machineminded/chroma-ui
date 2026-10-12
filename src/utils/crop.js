// Crop math for img2img source images.
//
// A crop is stored resolution-independently as { cx, cy, zoom }:
//  - cx, cy — crop center, normalized to the source image (0..1)
//  - zoom   — multiplier on top of the "cover" scale (1 = the smallest crop that
//             still fills the target frame; >1 zooms in further)
// so it stays valid when the target generation size changes.

export const DEFAULT_CROP = { cx: 0.5, cy: 0.5, zoom: 1 };
export const MAX_CROP_ZOOM = 8;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Resolve a crop to a source-pixel rectangle for a target size.
 * @returns { x, y, w, h, scale } — `scale` is target px per source px (>1 = upscaling)
 */
export function computeCropRect(src, crop, targetW, targetH) {
  const cover = Math.max(targetW / src.w, targetH / src.h);
  const scale = cover * clamp(crop.zoom, 1, MAX_CROP_ZOOM);
  const w = targetW / scale;
  const h = targetH / scale;
  const x = clamp(crop.cx * src.w - w / 2, 0, src.w - w);
  const y = clamp(crop.cy * src.h - h / 2, 0, src.h - h);
  return { x, y, w, h, scale };
}

/** Normalize a crop so its center stays inside the area the frame can actually reach. */
export function clampCrop(src, crop, targetW, targetH) {
  const zoom = clamp(crop.zoom, 1, MAX_CROP_ZOOM);
  const r = computeCropRect(src, { ...crop, zoom }, targetW, targetH);
  return { cx: (r.x + r.w / 2) / src.w, cy: (r.y + r.h / 2) / src.h, zoom };
}

/** Load an image URL and return its natural size. */
export function loadImageSize(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

/** Render the cropped region of `source` at exactly targetW × targetH and return a PNG blob. */
export async function renderCrop(source, crop, targetW, targetH) {
  // Fetch as blob to avoid any CORS/tainted-canvas issues
  const res = await fetch(source.url);
  const bitmap = await createImageBitmap(await res.blob());
  const r = computeCropRect(source, crop, targetW, targetH);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, targetW, targetH);
  bitmap.close();

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
