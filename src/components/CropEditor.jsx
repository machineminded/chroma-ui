import { useEffect, useRef, useState } from "react";
import { COLORS, sliderStyle, valStyle, labelStyle } from "../styles";
import { computeCropRect, clampCrop, DEFAULT_CROP, MAX_CROP_ZOOM } from "../utils/crop";

/**
 * Static preview of a crop — the exact region img2img will send, shown at `width`
 * display px wide with the target's aspect ratio.
 */
export function CropPreview({ source, crop, targetW, targetH, width, onClick }) {
  const frameH = width * (targetH / targetW);
  const r = computeCropRect(source, crop, targetW, targetH);
  const d = width / r.w; // display px per source px

  return (
    <div
      onClick={onClick}
      title={onClick ? "Adjust crop" : undefined}
      style={{
        position: "relative", width, height: frameH, overflow: "hidden",
        borderRadius: 4, border: `1px solid ${COLORS.border}`, background: COLORS.bgDarker,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <img
        src={source.url} alt="" draggable={false}
        style={{
          position: "absolute", left: -r.x * d, top: -r.y * d,
          width: source.w * d, height: source.h * d, maxWidth: "none",
        }}
      />
    </div>
  );
}

/**
 * Modal crop editor. The frame has the target generation size's aspect ratio and
 * stays fixed; the user drags the source image behind it and zooms with the
 * slider or mouse wheel. Larger sources can be cropped down, smaller sources are
 * scaled up to cover the frame and can be zoomed further to pick an area.
 */
export default function CropEditor({ source, crop, targetW, targetH, onChange, onClose }) {
  const FRAME_MAX = 460;
  const MARGIN = 48; // area outside the frame where the rest of the image shows dimmed
  const frameScale = Math.min(FRAME_MAX / targetW, FRAME_MAX / targetH);
  const frameW = targetW * frameScale;
  const frameH = targetH * frameScale;

  const r = computeCropRect(source, crop, targetW, targetH);
  const d = frameW / r.w; // display px per source px

  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const update = (next) => onChange(clampCrop(source, next, targetW, targetH));

  // Window-level listeners so the drag keeps tracking outside the stage
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const s = dragRef.current;
      const centerX = s.centerX - (e.clientX - s.mouseX) / s.d;
      const centerY = s.centerY - (e.clientY - s.mouseY) / s.d;
      update({ ...crop, cx: centerX / source.w, cy: centerY / source.h });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, crop, source, targetW, targetH]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      centerX: r.x + r.w / 2, centerY: r.y + r.h / 2, d,
    };
    setDragging(true);
  };

  const handleWheel = (e) => {
    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    update({ ...crop, zoom: crop.zoom * factor });
  };

  const upscaling = r.scale > 1.001;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        background: COLORS.bgDark, border: `1px solid ${COLORS.border}`, borderRadius: 8,
        padding: 16, display: "flex", flexDirection: "column", gap: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
          <span style={{ ...labelStyle, color: COLORS.accent, fontWeight: 700 }}>Crop Source Image</span>
          <span style={{ fontSize: 10, color: COLORS.textDimmer }}>Drag to move · Scroll to zoom</span>
        </div>

        {/* Stage */}
        <div
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          style={{
            position: "relative", width: frameW + MARGIN * 2, height: frameH + MARGIN * 2,
            overflow: "hidden", background: COLORS.bgDarker, borderRadius: 4,
            cursor: dragging ? "grabbing" : "grab", alignSelf: "center",
          }}
        >
          <img
            src={source.url} alt="" draggable={false}
            style={{
              position: "absolute", left: MARGIN - r.x * d, top: MARGIN - r.y * d,
              width: source.w * d, height: source.h * d, maxWidth: "none", pointerEvents: "none",
            }}
          />
          {/* Frame — the huge box-shadow dims everything outside it */}
          <div style={{
            position: "absolute", left: MARGIN, top: MARGIN, width: frameW, height: frameH,
            boxShadow: "0 0 0 9999px rgba(13,13,15,0.72)", outline: `1px solid ${COLORS.accent}`,
            pointerEvents: "none",
          }} />
        </div>

        {/* Zoom */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={labelStyle}>Zoom</label>
            <span style={valStyle}>{crop.zoom.toFixed(2)}×</span>
          </div>
          <input type="range" min={1} max={MAX_CROP_ZOOM} step={0.01} value={crop.zoom}
            onChange={(e) => update({ ...crop, zoom: Number(e.target.value) })} style={sliderStyle} />
        </div>

        <div style={{ fontSize: 10, color: COLORS.textDim, lineHeight: 1.6 }}>
          Source {source.w} × {source.h} → Target {targetW} × {targetH}<br />
          Using {Math.round(r.w)} × {Math.round(r.h)} px of the source ·{" "}
          <span style={{ color: upscaling ? "#f59e0b" : COLORS.success }}>
            {upscaling ? `upscaled ${r.scale.toFixed(2)}×` : `downscaled ${(1 / r.scale).toFixed(2)}×`}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => onChange(DEFAULT_CROP)} style={buttonStyle(false)}>Reset</button>
          <button onClick={onClose} style={buttonStyle(true)}>Done</button>
        </div>
      </div>
    </div>
  );
}

function buttonStyle(primary) {
  return {
    background: primary ? "#a78bfa22" : "transparent",
    border: `1px solid ${primary ? "#a78bfa66" : COLORS.border}`, borderRadius: 4,
    color: primary ? COLORS.accent : COLORS.textDim, cursor: "pointer",
    padding: "5px 14px", fontSize: 11, fontFamily: "inherit",
  };
}
