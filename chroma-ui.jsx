import { useState, useRef, useEffect, useCallback } from "react";

const COMFYUI_DEFAULT = "http://127.0.0.1:8188";

// --- ComfyUI API Layer ---
const comfyApi = {
  async queuePrompt(serverUrl, workflow) {
    const res = await fetch(`${serverUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });
    if (!res.ok) throw new Error(`ComfyUI error: ${res.status}`);
    return res.json();
  },
  async getHistory(serverUrl, promptId) {
    const res = await fetch(`${serverUrl}/history/${promptId}`);
    return res.json();
  },
  async getImage(serverUrl, filename, subfolder, type) {
    const params = new URLSearchParams({ filename, subfolder: subfolder || "", type: type || "output" });
    return `${serverUrl}/view?${params}`;
  },
  buildTxt2ImgWorkflow(positive, negative, width, height, seed, steps, cfg) {
    return {
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: seed ?? Math.floor(Math.random() * 2 ** 32),
          steps: steps || 28,
          cfg: cfg || 1.0,
          sampler_name: "euler",
          scheduler: "simple",
          denoise: 1.0,
          model: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          latent_image: ["5", 0],
        },
      },
      "4": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: "chroma-unlocked-v35.safetensors" },
      },
      "5": {
        class_type: "EmptyLatentImage",
        inputs: { width, height, batch_size: 1 },
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: positive, clip: ["4", 1] },
      },
      "7": {
        class_type: "CLIPTextEncode",
        inputs: { text: negative || "", clip: ["4", 1] },
      },
      "8": {
        class_type: "VAEDecode",
        inputs: { samples: ["3", 0], vae: ["4", 2] },
      },
      "9": {
        class_type: "SaveImage",
        inputs: { filename_prefix: "Chroma", images: ["8", 0] },
      },
    };
  },
};

// --- Icons as inline SVGs ---
const Icons = {
  Pointer: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
  ),
  Brush: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
  ),
  Eraser: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  ),
  Move: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </svg>
  ),
  ZoomIn: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  ),
  Crop: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" /><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </svg>
  ),
  Wand: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z" />
      <path d="m14 7 3 3" />
    </svg>
  ),
  Inpaint: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" strokeDasharray="2 2" />
    </svg>
  ),
  Upscale: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  ),
  Generate: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  Connected: () => (
    <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#22c55e" /></svg>
  ),
  Disconnected: () => (
    <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#ef4444" /></svg>
  ),
  Layers: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Undo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  ),
  Redo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  ),
};

// --- Toolbar ---
const tools = [
  { id: "pointer", icon: Icons.Pointer, label: "Select (V)", shortcut: "v" },
  { id: "move", icon: Icons.Move, label: "Move (M)", shortcut: "m" },
  { id: "brush", icon: Icons.Brush, label: "Brush (B)", shortcut: "b" },
  { id: "eraser", icon: Icons.Eraser, label: "Eraser (E)", shortcut: "e" },
  { id: "inpaint", icon: Icons.Inpaint, label: "Inpaint Mask (I)", shortcut: "i" },
  { id: "crop", icon: Icons.Crop, label: "Crop (C)", shortcut: "c" },
  { id: "zoom", icon: Icons.ZoomIn, label: "Zoom (Z)", shortcut: "z" },
];

const CANVAS_SIZES = [
  { label: "512 × 512", w: 512, h: 512 },
  { label: "768 × 768", w: 768, h: 768 },
  { label: "1024 × 1024", w: 1024, h: 1024 },
  { label: "768 × 1024", w: 768, h: 1024 },
  { label: "1024 × 768", w: 1024, h: 768 },
  { label: "1280 × 720", w: 1280, h: 720 },
  { label: "1344 × 768", w: 1344, h: 768 },
];

export default function ChromaUI() {
  // State
  const [activeTool, setActiveTool] = useState("pointer");
  const [serverUrl, setServerUrl] = useState(COMFYUI_DEFAULT);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES[2]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Ready");
  const [generatedImages, setGeneratedImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [seed, setSeed] = useState(-1);
  const [steps, setSteps] = useState(28);
  const [cfg, setCfg] = useState(1.0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [checkpoint, setCheckpoint] = useState("chroma-unlocked-v35.safetensors");

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const wsRef = useRef(null);

  // Check ComfyUI connection
  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`${serverUrl}/system_stats`);
      if (res.ok) {
        setConnected(true);
        setStatusMsg("Connected to ComfyUI");
      } else {
        setConnected(false);
        setStatusMsg("ComfyUI not responding");
      }
    } catch {
      setConnected(false);
      setStatusMsg("Cannot reach ComfyUI");
    }
    setChecking(false);
  }, [serverUrl]);

  useEffect(() => {
    checkConnection();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const tool = tools.find((t) => t.shortcut === e.key.toLowerCase());
      if (tool) setActiveTool(tool.id);
      if (e.key === "=" || e.key === "+") setZoom((z) => Math.min(z + 0.1, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.1, 0.1));
      if (e.key === "0") { setZoom(1); setPanOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Canvas rendering
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
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = currentImage;
    }
  }, [canvasSize, currentImage]);

  // Mouse handlers for panning
  const handleCanvasMouseDown = (e) => {
    if (activeTool === "move" || e.button === 1 || (e.button === 0 && e.spaceKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };
  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };
  const handleCanvasMouseUp = () => setIsPanning(false);
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((z) => Math.max(0.1, Math.min(5, z + delta)));
  };

  // Generate image
  const handleGenerate = async () => {
    if (!connected) {
      setStatusMsg("Not connected to ComfyUI");
      return;
    }
    if (!positive.trim()) {
      setStatusMsg("Enter a prompt first");
      return;
    }

    setGenerating(true);
    setProgress(0);
    setStatusMsg("Queueing prompt...");

    try {
      const actualSeed = seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed;
      const workflow = comfyApi.buildTxt2ImgWorkflow(positive, negative, canvasSize.w, canvasSize.h, actualSeed, steps, cfg);
      // Override checkpoint name
      workflow["4"].inputs.ckpt_name = checkpoint;

      const { prompt_id } = await comfyApi.queuePrompt(serverUrl, workflow);
      setStatusMsg("Generating...");

      // Poll for completion via WebSocket or polling
      const pollForResult = async () => {
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes max
        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
          setProgress(Math.min(95, (attempts / (steps * 1.2)) * 100));

          try {
            const history = await comfyApi.getHistory(serverUrl, prompt_id);
            if (history[prompt_id]?.outputs) {
              const outputs = history[prompt_id].outputs;
              for (const nodeId of Object.keys(outputs)) {
                if (outputs[nodeId].images) {
                  const img = outputs[nodeId].images[0];
                  const imageUrl = await comfyApi.getImage(serverUrl, img.filename, img.subfolder, img.type);
                  setCurrentImage(imageUrl);
                  setGeneratedImages((prev) => [
                    { url: imageUrl, prompt: positive, timestamp: Date.now(), seed: actualSeed },
                    ...prev,
                  ]);
                  setProgress(100);
                  setStatusMsg("Done!");
                  setGenerating(false);
                  return;
                }
              }
            }
          } catch {
            // Keep polling
          }
        }
        setStatusMsg("Generation timed out");
        setGenerating(false);
      };

      pollForResult();
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
      setGenerating(false);
    }
  };

  const sideW = 260;
  const toolbarW = 44;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#1a1a1e",
        color: "#c8c8cc",
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        fontSize: 12,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* ===== TOP MENU BAR ===== */}
      <div
        style={{
          height: 32,
          background: "#111113",
          borderBottom: "1px solid #2a2a2e",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, color: "#a78bfa", letterSpacing: 2, fontSize: 13, textTransform: "uppercase" }}>
          ◆ Chroma
        </span>
        <span style={{ color: "#555", fontSize: 11 }}>|</span>
        {["File", "Edit", "View", "Image", "Generate"].map((m) => (
          <span key={m} style={{ cursor: "pointer", padding: "2px 6px", borderRadius: 3, fontSize: 11, color: "#888" }}
            onMouseEnter={(e) => (e.target.style.color = "#ccc")}
            onMouseLeave={(e) => (e.target.style.color = "#888")}
          >{m}</span>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {connected ? <Icons.Connected /> : <Icons.Disconnected />}
          <span style={{ fontSize: 10, color: connected ? "#22c55e" : "#ef4444" }}>
            {connected ? "ComfyUI" : "Offline"}
          </span>
        </div>
      </div>

      {/* ===== MAIN AREA ===== */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ===== LEFT TOOLBAR ===== */}
        <div
          style={{
            width: toolbarW,
            background: "#111113",
            borderRight: "1px solid #2a2a2e",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 8,
            gap: 2,
            flexShrink: 0,
          }}
        >
          {tools.map((t) => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => setActiveTool(t.id)}
              style={{
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                background: activeTool === t.id ? "#a78bfa22" : "transparent",
                color: activeTool === t.id ? "#a78bfa" : "#777",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (activeTool !== t.id) e.currentTarget.style.background = "#ffffff08";
              }}
              onMouseLeave={(e) => {
                if (activeTool !== t.id) e.currentTarget.style.background = "transparent";
              }}
            >
              <t.icon />
            </button>
          ))}

          <div style={{ height: 1, width: 24, background: "#2a2a2e", margin: "6px 0" }} />

          {/* Action tools */}
          {[
            { id: "generate", icon: Icons.Generate, label: "Generate", color: "#a78bfa" },
            { id: "upscale", icon: Icons.Upscale, label: "Upscale" },
          ].map((t) => (
            <button
              key={t.id}
              title={t.label}
              onClick={t.id === "generate" ? handleGenerate : undefined}
              style={{
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                background: "transparent",
                color: t.color || "#777",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <t.icon />
            </button>
          ))}
        </div>

        {/* ===== CANVAS AREA ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Canvas */}
          <div
            ref={canvasContainerRef}
            style={{
              flex: 1,
              overflow: "hidden",
              background: "#0d0d0f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: activeTool === "move" ? (isPanning ? "grabbing" : "grab") : "crosshair",
              position: "relative",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
          >
            {/* Grid dots background */}
            <div style={{
              position: "absolute", inset: 0, opacity: 0.15,
              backgroundImage: "radial-gradient(circle, #555 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />

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
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{
                    width: canvasSize.w * Math.min(1, 600 / Math.max(canvasSize.w, canvasSize.h)),
                    height: canvasSize.h * Math.min(1, 600 / Math.max(canvasSize.w, canvasSize.h)),
                  }}
                />
              </div>
              {/* Canvas size label */}
              <div style={{
                position: "absolute", bottom: -22, left: "50%", transform: "translateX(-50%)",
                fontSize: 10, color: "#555", whiteSpace: "nowrap",
              }}>
                {canvasSize.w} × {canvasSize.h}
              </div>
            </div>

            {/* Zoom indicator */}
            <div style={{
              position: "absolute", bottom: 8, right: 8,
              fontSize: 10, color: "#555", background: "#111113cc", padding: "3px 8px", borderRadius: 4,
            }}>
              {Math.round(zoom * 100)}%
            </div>

            {/* Progress overlay */}
            {generating && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
              }}>
                <div style={{
                  width: 200, height: 3, background: "#2a2a2e", borderRadius: 2, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", background: "linear-gradient(90deg, #a78bfa, #7c3aed)",
                    width: `${progress}%`, transition: "width 0.3s",
                    boxShadow: "0 0 10px #a78bfa88",
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "#a78bfa" }}>{statusMsg}</span>
              </div>
            )}
          </div>

          {/* ===== BOTTOM PROMPT BAR ===== */}
          <div
            style={{
              background: "#141416",
              borderTop: "1px solid #2a2a2e",
              padding: "10px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {/* Positive prompt */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, color: "#a78bfa", minWidth: 24, paddingTop: 6, fontWeight: 600 }}>+</span>
              <textarea
                value={positive}
                onChange={(e) => setPositive(e.target.value)}
                placeholder="Describe your image... (positive prompt)"
                rows={2}
                style={{
                  flex: 1, background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 6,
                  color: "#ddd", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                  resize: "vertical", outline: "none", minHeight: 36,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#a78bfa55")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2e")}
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !positive.trim()}
                style={{
                  padding: "8px 20px", height: 36,
                  background: generating ? "#333" : "linear-gradient(135deg, #7c3aed, #a78bfa)",
                  border: "none", borderRadius: 6, color: "#fff", fontWeight: 700,
                  cursor: generating ? "wait" : "pointer", fontSize: 12, fontFamily: "inherit",
                  letterSpacing: 1, textTransform: "uppercase",
                  opacity: !positive.trim() ? 0.4 : 1,
                  transition: "all 0.2s",
                  boxShadow: generating ? "none" : "0 0 20px rgba(167,139,250,0.2)",
                }}
              >
                {generating ? "..." : "Generate"}
              </button>
            </div>
            {/* Negative prompt */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, color: "#ef4444", minWidth: 24, paddingTop: 6, fontWeight: 600 }}>−</span>
              <textarea
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                placeholder="What to avoid... (negative prompt)"
                rows={1}
                style={{
                  flex: 1, background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 6,
                  color: "#ddd", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                  resize: "vertical", outline: "none", minHeight: 28,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#ef444455")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2e")}
              />
            </div>
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div
          style={{
            width: sideW,
            background: "#111113",
            borderLeft: "1px solid #2a2a2e",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {/* Panel Tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid #2a2a2e", background: "#0d0d0f",
          }}>
            {[
              { icon: Icons.Settings, label: "Config" },
              { icon: Icons.Layers, label: "Layers" },
              { icon: Icons.History, label: "History" },
            ].map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setShowSettings(tab.label === "Config" ? true : false)}
                style={{
                  flex: 1, padding: "8px 0", border: "none", background: "transparent",
                  color: (showSettings && tab.label === "Config") || (!showSettings && tab.label === "History") ? "#a78bfa" : "#555",
                  cursor: "pointer", fontSize: 10, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 2, fontFamily: "inherit",
                  borderBottom: (showSettings && tab.label === "Config") || (!showSettings && tab.label === "History")
                    ? "2px solid #a78bfa" : "2px solid transparent",
                }}
              >
                <tab.icon />
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {showSettings ? (
              /* ===== SETTINGS PANEL ===== */
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Connection */}
                <div>
                  <label style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
                    ComfyUI Server
                  </label>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <input
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      style={{
                        flex: 1, background: "#0d0d0f", border: "1px solid #2a2a2e", borderRadius: 4,
                        color: "#ccc", padding: "5px 8px", fontSize: 11, fontFamily: "inherit", outline: "none",
                      }}
                    />
                    <button
                      onClick={checkConnection}
                      disabled={checking}
                      style={{
                        background: "#2a2a2e", border: "none", borderRadius: 4, color: "#aaa",
                        padding: "4px 10px", cursor: "pointer", fontSize: 10, fontFamily: "inherit",
                      }}
                    >
                      {checking ? "..." : "Test"}
                    </button>
                  </div>
                </div>

                <div style={{ height: 1, background: "#2a2a2e" }} />

                {/* Model */}
                <div>
                  <label style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
                    Checkpoint
                  </label>
                  <input
                    value={checkpoint}
                    onChange={(e) => setCheckpoint(e.target.value)}
                    style={{
                      width: "100%", marginTop: 4, background: "#0d0d0f", border: "1px solid #2a2a2e",
                      borderRadius: 4, color: "#ccc", padding: "5px 8px", fontSize: 11,
                      fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Canvas Size */}
                <div>
                  <label style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
                    Canvas Size
                  </label>
                  <select
                    value={`${canvasSize.w}x${canvasSize.h}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split("x").map(Number);
                      setCanvasSize({ label: `${w} × ${h}`, w, h });
                    }}
                    style={{
                      width: "100%", marginTop: 4, background: "#0d0d0f", border: "1px solid #2a2a2e",
                      borderRadius: 4, color: "#ccc", padding: "5px 8px", fontSize: 11,
                      fontFamily: "inherit", outline: "none", cursor: "pointer",
                    }}
                  >
                    {CANVAS_SIZES.map((s) => (
                      <option key={s.label} value={`${s.w}x${s.h}`}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Steps */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
                      Steps
                    </label>
                    <span style={{ fontSize: 11, color: "#a78bfa" }}>{steps}</span>
                  </div>
                  <input
                    type="range" min={1} max={80} value={steps}
                    onChange={(e) => setSteps(Number(e.target.value))}
                    style={{ width: "100%", marginTop: 4, accentColor: "#a78bfa" }}
                  />
                </div>

                {/* CFG */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
                      CFG Scale
                    </label>
                    <span style={{ fontSize: 11, color: "#a78bfa" }}>{cfg.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min={0} max={20} step={0.5} value={cfg}
                    onChange={(e) => setCfg(Number(e.target.value))}
                    style={{ width: "100%", marginTop: 4, accentColor: "#a78bfa" }}
                  />
                </div>

                {/* Seed */}
                <div>
                  <label style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
                    Seed <span style={{ color: "#555" }}>(-1 = random)</span>
                  </label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    style={{
                      width: "100%", marginTop: 4, background: "#0d0d0f", border: "1px solid #2a2a2e",
                      borderRadius: 4, color: "#ccc", padding: "5px 8px", fontSize: 11,
                      fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            ) : (
              /* ===== HISTORY PANEL ===== */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {generatedImages.length === 0 ? (
                  <div style={{ color: "#444", fontSize: 11, textAlign: "center", padding: 20 }}>
                    No images generated yet.
                    <br />
                    <span style={{ color: "#555", fontSize: 10 }}>
                      Enter a prompt and click Generate.
                    </span>
                  </div>
                ) : (
                  generatedImages.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentImage(img.url)}
                      style={{
                        background: currentImage === img.url ? "#a78bfa15" : "#0d0d0f",
                        border: `1px solid ${currentImage === img.url ? "#a78bfa44" : "#2a2a2e"}`,
                        borderRadius: 6, padding: 6, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <img
                        src={img.url}
                        alt=""
                        style={{
                          width: "100%", height: 120, objectFit: "cover",
                          borderRadius: 4, display: "block",
                        }}
                      />
                      <div style={{ fontSize: 10, color: "#777", marginTop: 4, overflow: "hidden",
                        whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {img.prompt}
                      </div>
                      <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
                        Seed: {img.seed}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div
        style={{
          height: 24,
          background: "#111113",
          borderTop: "1px solid #2a2a2e",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 16,
          fontSize: 10,
          color: "#555",
          flexShrink: 0,
        }}
      >
        <span>{statusMsg}</span>
        <div style={{ flex: 1 }} />
        <span>{canvasSize.w} × {canvasSize.h}</span>
        <span>|</span>
        <span>{activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</span>
        <span>|</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
