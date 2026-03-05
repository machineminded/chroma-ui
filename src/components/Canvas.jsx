import { useRef, useEffect, useState, useCallback } from "react";
import Icons from "./Icons";
import { COLORS, sliderStyle, valStyle, labelStyle } from "../styles";
import { DEFAULTS } from "../constants";

/**
 * Canvas component with:
 *  - Main image canvas (checkerboard + generated image)
 *  - Inpaint mask overlay canvas (semi-transparent red)
 *  - Pan / zoom
 *  - Inpaint brush drawing
 *  - Inpaint toolbar strip when inpaint tool is active
 */
async function downloadImage(url, filename) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export default function Canvas({
  canvasSize,
  currentImage,
  currentImageFilename,
  activeTool,
  generating,
  progress,
  statusMsg,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
  // Inpaint
  maskCanvasRef,    // ref to the mask canvas (shared with parent for export)
  hasMask,
  setHasMask,
  onMaskStrokeDone, // called immediately when user lifts the brush
  inpaintDenoise,
  setInpaintDenoise,
  inpaintContextExtend,
  setInpaintContextExtend,
  brushSize,
  setBrushSize,
  onClearMask,
  onCancel,
  // Upscale
  upscaleBy,
  setUpscaleBy,
  upscaleTileWidth,
  setUpscaleTileWidth,
  upscaleTileHeight,
  setUpscaleTileHeight,
  upscaleDenoise,
  setUpscaleDenoise,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  // Scale factor for CSS display size vs native resolution
  const displayScale = Math.min(1, 600 / Math.max(canvasSize.w, canvasSize.h));
  const displayW = canvasSize.w * displayScale;
  const displayH = canvasSize.h * displayScale;

  // ----- Render main canvas -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;

    // Checkerboard
    const size = 16;
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? "#2a2a2e" : "#323236";
        ctx.fillRect(x, y, size, size);
      }
    }

    if (currentImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = currentImage;
    }
  }, [canvasSize, currentImage]);

  // ----- Init mask canvas -----
  useEffect(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    mask.width = canvasSize.w;
    mask.height = canvasSize.h;
  }, [canvasSize, maskCanvasRef]);

  // ----- Get canvas-local coords from mouse event -----
  const getCanvasCoords = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaleX = canvasSize.w / rect.width;
    const scaleY = canvasSize.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [canvasSize]);

  // ----- Inpaint brush drawing -----
  const drawOnMask = useCallback((x, y) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [brushSize, maskCanvasRef]);

  const eraseOnMask = useCallback((x, y) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, [brushSize, maskCanvasRef]);

  // ----- Mouse handlers -----
  const handleMouseDown = (e) => {
    if (activeTool === "move" || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }
    if (activeTool === "inpaint" && e.button === 0) {
      setIsDrawing(true);
      const { x, y } = getCanvasCoords(e);
      if (e.altKey) {
        eraseOnMask(x, y);
      } else {
        drawOnMask(x, y);
        setHasMask(true);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (isDrawing && activeTool === "inpaint") {
      const { x, y } = getCanvasCoords(e);
      if (e.altKey) {
        eraseOnMask(x, y);
      } else {
        drawOnMask(x, y);
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
    if (isDrawing) {
      setIsDrawing(false);
      onMaskStrokeDone?.();
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((z) => Math.max(0.1, Math.min(5, z + delta)));
  };

  const isInpaintActive = activeTool === "inpaint";
  const isUpscaleActive = activeTool === "upscale";
  const cursor = activeTool === "move"
    ? (isPanning ? "grabbing" : "grab")
    : isInpaintActive ? "crosshair" : "default";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Inpaint toolbar strip */}
      {isInpaintActive && (
        <div
          style={{
            height: 36,
            background: COLORS.bgDark,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 16,
            flexShrink: 0,
            fontSize: 10,
          }}
        >
          {/* Brush size */}
          <span style={{ color: COLORS.textDim }}>Brush</span>
          <input
            type="range" min={4} max={200} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: 80, accentColor: COLORS.accent }}
          />
          <span style={valStyle}>{brushSize}px</span>

          <span style={{ color: COLORS.border }}>|</span>

          {/* Denoise */}
          <span style={{ color: COLORS.textDim }}>Denoise</span>
          <input
            type="range" min={0} max={1} step={0.05} value={inpaintDenoise}
            onChange={(e) => setInpaintDenoise(Number(e.target.value))}
            style={{ width: 80, accentColor: COLORS.accent }}
          />
          <span style={valStyle}>{inpaintDenoise.toFixed(2)}</span>

          <span style={{ color: COLORS.border }}>|</span>

          {/* Context extend */}
          <span style={{ color: COLORS.textDim }}>Context</span>
          <input
            type="range" min={0.1} max={4} step={0.1} value={inpaintContextExtend}
            onChange={(e) => setInpaintContextExtend(Number(e.target.value))}
            style={{ width: 80, accentColor: COLORS.accent }}
          />
          <span style={valStyle}>{inpaintContextExtend.toFixed(1)}</span>

          <span style={{ color: COLORS.border }}>|</span>

          {/* Clear mask */}
          <button
            onClick={onClearMask}
            style={{
              background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 4,
              color: hasMask ? COLORS.danger : COLORS.textDimmer, cursor: "pointer",
              padding: "3px 8px", fontSize: 10, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Icons.ClearMask /> Clear Mask
          </button>

          <span style={{ color: COLORS.textDimmest, fontSize: 9, marginLeft: "auto" }}>
            Alt+click to erase mask
          </span>
        </div>
      )}

      {/* Upscale toolbar strip */}
      {isUpscaleActive && (
        <div
          style={{
            height: 36,
            background: COLORS.bgDark,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 16,
            flexShrink: 0,
            fontSize: 10,
          }}
        >
          {/* Upscale By */}
          <span style={{ color: COLORS.textDim }}>Scale</span>
          <select
            value={upscaleBy}
            onChange={(e) => setUpscaleBy(Number(e.target.value))}
            style={{
              background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`,
              borderRadius: 4, color: "#ccc", padding: "2px 6px", fontSize: 10,
              fontFamily: "inherit", outline: "none",
            }}
          >
            {[1.5, 2, 3, 4].map((v) => (
              <option key={v} value={v}>{v}×</option>
            ))}
          </select>

          <span style={{ color: COLORS.border }}>|</span>

          {/* Tile Width */}
          <span style={{ color: COLORS.textDim }}>Tile W</span>
          <input
            type="range" min={512} max={2048} step={64} value={upscaleTileWidth}
            onChange={(e) => setUpscaleTileWidth(Number(e.target.value))}
            style={{ width: 70, accentColor: COLORS.accent }}
          />
          <span style={valStyle}>{upscaleTileWidth}</span>

          <span style={{ color: COLORS.border }}>|</span>

          {/* Tile Height */}
          <span style={{ color: COLORS.textDim }}>Tile H</span>
          <input
            type="range" min={512} max={2048} step={64} value={upscaleTileHeight}
            onChange={(e) => setUpscaleTileHeight(Number(e.target.value))}
            style={{ width: 70, accentColor: COLORS.accent }}
          />
          <span style={valStyle}>{upscaleTileHeight}</span>

          <span style={{ color: COLORS.border }}>|</span>

          {/* Denoise */}
          <span style={{ color: COLORS.textDim }}>Denoise</span>
          <input
            type="range" min={0} max={1} step={0.05} value={upscaleDenoise}
            onChange={(e) => setUpscaleDenoise(Number(e.target.value))}
            style={{ width: 80, accentColor: COLORS.accent }}
          />
          <span style={valStyle}>{upscaleDenoise.toFixed(2)}</span>

          {!currentImage && (
            <span style={{ color: COLORS.danger, fontSize: 9, marginLeft: "auto" }}>
              Generate an image first
            </span>
          )}
        </div>
      )}

      {/* Canvas viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          background: COLORS.bgDarker,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor,
          position: "relative",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid dots background */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.15,
          backgroundImage: "radial-gradient(circle, #555 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />

        {/* Download button */}
        {currentImage && currentImageFilename && (
          <button
            onClick={() => downloadImage(currentImage, currentImageFilename)}
            title={`Download ${currentImageFilename}`}
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 10,
              background: "rgba(0,0,0,0.55)", border: `1px solid ${COLORS.border}`,
              borderRadius: 6, color: COLORS.textDim, cursor: "pointer",
              padding: "5px 8px", display: "flex", alignItems: "center", gap: 5,
              fontSize: 10, fontFamily: "inherit", backdropFilter: "blur(4px)",
            }}
          >
            <Icons.Download /> {currentImageFilename}
          </button>
        )}

        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transition: isPanning ? "none" : "transform 0.1s ease-out",
            position: "relative",
          }}
        >
          {/* Canvas shadow + border */}
          <div
            style={{
              boxShadow: "0 0 60px rgba(167, 139, 250, 0.08), 0 4px 30px rgba(0,0,0,0.5)",
              border: "1px solid #333",
              lineHeight: 0,
              position: "relative",
            }}
          >
            {/* Main image canvas */}
            <canvas
              ref={canvasRef}
              style={{ width: displayW, height: displayH, display: "block" }}
            />
            {/* Mask overlay canvas — positioned exactly on top */}
            <canvas
              ref={maskCanvasRef}
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: displayW, height: displayH,
                opacity: isInpaintActive ? 0.45 : 0,
                pointerEvents: "none",
                mixBlendMode: "normal",
                // Render the white mask as a red tint
                filter: isInpaintActive ? "hue-rotate(0deg) saturate(5) brightness(0.8)" : "none",
                // Use CSS to colorize — mask canvas has white strokes, we show as red
              }}
            />
            {/* Colored overlay for mask visibility */}
            {isInpaintActive && hasMask && (
              <MaskColorOverlay maskCanvasRef={maskCanvasRef} width={displayW} height={displayH} />
            )}
          </div>

          {/* Canvas size label */}
          <div style={{
            position: "absolute", bottom: -22, left: "50%", transform: "translateX(-50%)",
            fontSize: 10, color: COLORS.textDimmer, whiteSpace: "nowrap",
          }}>
            {canvasSize.w} × {canvasSize.h}
          </div>
        </div>

        {/* Zoom indicator */}
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          fontSize: 10, color: COLORS.textDimmer, background: `${COLORS.bgDark}cc`,
          padding: "3px 8px", borderRadius: 4,
        }}>
          {Math.round(zoom * 100)}%
        </div>

        {/* Progress overlay */}
        {generating && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ width: 200, height: 3, background: COLORS.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentDark})`,
                width: `${progress}%`, transition: "width 0.3s",
                boxShadow: "0 0 10px #a78bfa88",
              }} />
            </div>
            <span style={{ fontSize: 11, color: COLORS.accent }}>{statusMsg}</span>
            <button
              onClick={onCancel}
              style={{
                marginTop: 4, padding: "5px 18px",
                background: "transparent", border: `1px solid ${COLORS.danger}`,
                borderRadius: 5, color: COLORS.danger, cursor: "pointer",
                fontSize: 11, fontFamily: "inherit", letterSpacing: 0.5,
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the mask as a semi-transparent red overlay using a secondary canvas.
 * Reads from the maskCanvasRef (white-on-transparent) and renders red.
 */
function MaskColorOverlay({ maskCanvasRef, width, height }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const src = maskCanvasRef.current;
      const dst = overlayRef.current;
      if (!src || !dst) return;
      dst.width = src.width;
      dst.height = src.height;
      const ctx = dst.getContext("2d");
      ctx.clearRect(0, 0, dst.width, dst.height);
      // Draw the mask
      ctx.drawImage(src, 0, 0);
      // Colorize: set composite to source-in, then fill red
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "rgba(255, 60, 60, 1)";
      ctx.fillRect(0, 0, dst.width, dst.height);
      ctx.globalCompositeOperation = "source-over";
    }, 50); // Update at ~20fps for smooth painting feedback
    return () => clearInterval(interval);
  }, [maskCanvasRef]);

  return (
    <canvas
      ref={overlayRef}
      style={{
        position: "absolute",
        top: 0, left: 0,
        width, height,
        opacity: 0.5,
        pointerEvents: "none",
      }}
    />
  );
}
