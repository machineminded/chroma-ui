import { useState, useRef, useEffect, useCallback } from "react";
import * as api from "./api/comfyApi";
import { tools } from "./components/Toolbar";
import { COMFYUI_DEFAULT, CANVAS_SIZES, DEFAULT_CANVAS_INDEX, DEFAULTS } from "./constants";
import { COLORS } from "./styles";

import MenuBar from "./components/MenuBar";
import Toolbar from "./components/Toolbar";
import Canvas from "./components/Canvas";
import PromptBar from "./components/PromptBar";
import ConfigPanel from "./components/ConfigPanel";
import StatusBar from "./components/StatusBar";

export default function ChromaUI() {
  // ---- Connection ----
  const [serverUrl, setServerUrl] = useState(COMFYUI_DEFAULT);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(false);

  // ---- Tools ----
  const [activeTool, setActiveTool] = useState("pointer");

  // ---- Prompts ----
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");

  // ---- Canvas ----
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES[DEFAULT_CANVAS_INDEX]);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // ---- Generation ----
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Ready");
  const [currentImageFilename, setCurrentImageFilename] = useState(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);

  // ---- Model config ----
  const [seed, setSeed] = useState(-1);
  const [steps, setSteps] = useState(DEFAULTS.steps);
  const [cfg, setCfg] = useState(DEFAULTS.cfg);
  const [shift, setShift] = useState(DEFAULTS.shift);
  const [betaAlpha, setBetaAlpha] = useState(DEFAULTS.betaAlpha);
  const [betaBeta, setBetaBeta] = useState(DEFAULTS.betaBeta);
  const [unetName, setUnetName] = useState(DEFAULTS.unetName);
  const [clipName, setClipName] = useState(DEFAULTS.clipName);
  const [vaeName, setVaeName] = useState(DEFAULTS.vaeName);

  // ---- LoRA ----
  const [lora1, setLora1] = useState("(none)");
  const [lora1Strength, setLora1Strength] = useState(1.0);
  const [lora2, setLora2] = useState("(none)");
  const [lora2Strength, setLora2Strength] = useState(1.0);
  const [availableLoras, setAvailableLoras] = useState([]);
  const [availableUnets, setAvailableUnets] = useState([]);
  const [availableClips, setAvailableClips] = useState([]);
  const [availableVaes, setAvailableVaes] = useState([]);

  // ---- Inpaint ----
  const [hasMask, setHasMask] = useState(false);
  const [inpaintDenoise, setInpaintDenoise] = useState(DEFAULTS.inpaintDenoise);
  const [inpaintContextExtend, setInpaintContextExtend] = useState(DEFAULTS.inpaintContextExtend);
  const [brushSize, setBrushSize] = useState(DEFAULTS.brushSize);
  const [contextImageUrl, setContextImageUrl] = useState(null);
  const maskCanvasRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ---- Upscale ----
  const [upscaleBy, setUpscaleBy] = useState(DEFAULTS.upscaleBy);
  const [upscaleTileWidth, setUpscaleTileWidth] = useState(DEFAULTS.upscaleTileWidth);
  const [upscaleTileHeight, setUpscaleTileHeight] = useState(DEFAULTS.upscaleTileHeight);
  const [upscaleDenoise, setUpscaleDenoise] = useState(DEFAULTS.upscaleDenoise);

  // ---- Styles ----
  const [selectedStyle, setSelectedStyle] = useState(null);

  // ---- Panel ----
  const [activeTab, setActiveTab] = useState("Config");

  // ===========================================================================
  // Connection
  // ===========================================================================
  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`${serverUrl}/system_stats`);
      if (res.ok) {
        setConnected(true);
        const [loras, models] = await Promise.all([
          api.fetchLoras(serverUrl),
          api.fetchModels(serverUrl),
        ]);
        setAvailableLoras(loras);
        setAvailableUnets(models.unets);
        setAvailableClips(models.clips);
        setAvailableVaes(models.vaes);
        setStatusMsg(loras.length > 0
          ? `Connected — ${loras.length} LoRA${loras.length !== 1 ? "s" : ""} found`
          : "Connected to ComfyUI"
        );
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

  useEffect(() => { checkConnection(); }, []);

  // ===========================================================================
  // Canvas size — derived from the loaded image
  // Whenever currentImage changes, read its actual pixel dimensions and sync
  // canvasSize so that the canvas always matches the image being displayed.
  // ===========================================================================
  useEffect(() => {
    if (!currentImage) return;
    const img = new window.Image();
    img.onload = () => {
      setCanvasSize(prev =>
        prev.w === img.naturalWidth && prev.h === img.naturalHeight
          ? prev
          : { w: img.naturalWidth, h: img.naturalHeight }
      );
    };
    img.src = currentImage;
  }, [currentImage]);

  // ===========================================================================
  // Keyboard shortcuts
  // ===========================================================================
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

  // ===========================================================================
  // Helper: upload current canvas image + mask as SEPARATE files to ComfyUI
  // Returns { imageName, maskName }
  // ===========================================================================
  const uploadCanvasAndMask = useCallback(async () => {
    // 1) Upload the source image (no alpha manipulation needed)
    const imgCanvas = document.createElement("canvas");
    imgCanvas.width = canvasSize.w;
    imgCanvas.height = canvasSize.h;
    const imgCtx = imgCanvas.getContext("2d");

    if (currentImage) {
      // Fetch as blob to avoid any CORS/tainted-canvas issues
      const response = await fetch(currentImage);
      const imgBlob = await response.blob();
      const bitmap = await createImageBitmap(imgBlob);
      imgCtx.drawImage(bitmap, 0, 0, canvasSize.w, canvasSize.h);
      bitmap.close();
    }

    const imageBlob = await new Promise((r) => imgCanvas.toBlob(r, "image/png"));
    const imageResult = await api.uploadImage(serverUrl, imageBlob, "chroma_source.png");
    console.log("[Chroma] Uploaded source image:", imageResult.fullName);

    // 2) Upload the mask as a separate image
    //    White pixels = inpaint area, black = keep
    //    LoadImageMask with channel="red" will read the R channel as the mask
    const maskCanvas = maskCanvasRef.current;
    const maskExportCanvas = document.createElement("canvas");
    maskExportCanvas.width = canvasSize.w;
    maskExportCanvas.height = canvasSize.h;
    const maskExportCtx = maskExportCanvas.getContext("2d");

    // Fill black (no mask)
    maskExportCtx.fillStyle = "black";
    maskExportCtx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    if (maskCanvas) {
      // Our mask canvas has white strokes where user painted
      // Copy it onto the export canvas
      maskExportCtx.drawImage(maskCanvas, 0, 0);

      // Count mask pixels for debug
      const maskData = maskExportCtx.getImageData(0, 0, canvasSize.w, canvasSize.h);
      let count = 0;
      for (let i = 0; i < maskData.data.length; i += 4) {
        if (maskData.data[i] > 128) count++;
      }
      console.log(`[Chroma] Mask: ${count} pixels out of ${canvasSize.w * canvasSize.h} (${(100 * count / (canvasSize.w * canvasSize.h)).toFixed(1)}%)`);
    }

    const maskBlob = await new Promise((r) => maskExportCanvas.toBlob(r, "image/png"));
    const maskResult = await api.uploadImage(serverUrl, maskBlob, "chroma_mask.png");
    console.log("[Chroma] Uploaded mask:", maskResult.fullName);

    return { imageName: imageResult.fullName, maskName: maskResult.fullName };
  }, [serverUrl, currentImage, canvasSize, maskCanvasRef]);

  // ===========================================================================
  // Inpaint context preview (called ~1s after brush stroke)
  // ===========================================================================
  const handleMaskStrokeDone = useCallback(async () => {
    if (!connected || !currentImage) return;
    setStatusMsg("Loading context preview...");

    try {
      const { imageName, maskName } = await uploadCanvasAndMask();

      const workflow = api.buildInpaintWorkflow({
        imageName, maskName,
        contextExtendFactor: inpaintContextExtend,
        outputWidth: canvasSize.w,
        outputHeight: canvasSize.h,
        contextOnly: true,
        positive: "", negative: "", seed: 0, steps: 8, cfg: 1, denoise: 0.5,
        shift: DEFAULTS.inpaintShift,
        unetName, clipName, vaeName,
        lora1, lora1Strength, lora2, lora2Strength,
      });

      const { prompt_id } = await api.queuePrompt(serverUrl, workflow);
      const outputs = await api.pollForCompletion(serverUrl, prompt_id, { steps: 1, maxAttempts: 30 });

      const ctxImg = api.findOutputImage(outputs, "38");
      if (ctxImg) {
        const url = api.getImageUrl(serverUrl, ctxImg.filename, ctxImg.subfolder, ctxImg.type);
        setContextImageUrl(url);
        setActiveTab("History");
        setStatusMsg("Context preview ready");
      }
    } catch (err) {
      setStatusMsg(`Context preview failed: ${err.message}`);
    }
  }, [connected, currentImage, serverUrl, inpaintContextExtend, canvasSize, uploadCanvasAndMask,
      unetName, clipName, vaeName, lora1, lora1Strength, lora2, lora2Strength]);

  // ===========================================================================
  // Cancel generation
  // ===========================================================================
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    api.interruptExecution(serverUrl);
  }, [serverUrl]);

  // ===========================================================================
  // Clear mask
  // ===========================================================================
  const handleClearMask = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (mask) {
      const ctx = mask.getContext("2d");
      ctx.clearRect(0, 0, mask.width, mask.height);
    }
    setHasMask(false);
    setContextImageUrl(null);
  }, []);

  // ===========================================================================
  // Helper: upload current canvas image to ComfyUI (for upscale)
  // ===========================================================================
  const uploadCurrentImage = useCallback(async () => {
    const imgCanvas = document.createElement("canvas");
    imgCanvas.width = canvasSize.w;
    imgCanvas.height = canvasSize.h;
    const imgCtx = imgCanvas.getContext("2d");

    if (currentImage) {
      const response = await fetch(currentImage);
      const imgBlob = await response.blob();
      const bitmap = await createImageBitmap(imgBlob);
      imgCtx.drawImage(bitmap, 0, 0, canvasSize.w, canvasSize.h);
      bitmap.close();
    }

    const blob = await new Promise((r) => imgCanvas.toBlob(r, "image/png"));
    const result = await api.uploadImage(serverUrl, blob, "chroma_upscale_input.png");
    console.log("[Chroma] Uploaded for upscale:", result.fullName);
    return result.fullName;
  }, [serverUrl, currentImage, canvasSize]);

  // ===========================================================================
  // Generate (txt2img, inpaint, or upscale depending on mode)
  // ===========================================================================
  const handleGenerate = useCallback(async () => {
    if (!connected) { setStatusMsg("Not connected to ComfyUI"); return; }
    if (!positive.trim()) { setStatusMsg("Enter a prompt first"); return; }

    const isUpscale = activeTool === "upscale";
    if (isUpscale && !currentImage) { setStatusMsg("Generate an image first before upscaling"); return; }

    abortControllerRef.current = new AbortController();
    setGenerating(true);
    setProgress(0);
    setStatusMsg("Queueing prompt...");

    const effectivePositive = selectedStyle
      ? `${positive}, ${selectedStyle.prompt}`
      : positive;

    try {
      const actualSeed = seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed;
      let workflow;
      let isInpaint = false;
      let genType = "txt2img";

      if (isUpscale) {
        // ---- UPSCALE ----
        genType = "upscale";
        setStatusMsg("Uploading image for upscale...");
        const imageName = await uploadCurrentImage();

        setStatusMsg("Upscaling...");
        workflow = api.buildUpscaleWorkflow({
          imageName, positive: effectivePositive, negative,
          seed: actualSeed, steps, cfg, shift,
          denoise: upscaleDenoise,
          unetName, clipName, vaeName,
          lora1, lora1Strength, lora2, lora2Strength,
          upscaleBy, tileWidth: upscaleTileWidth, tileHeight: upscaleTileHeight,
          upscaleModelName: DEFAULTS.upscaleModelName,
        });
      } else if (hasMask && currentImage) {
        // ---- INPAINT ----
        isInpaint = true;
        genType = "inpaint";
        setStatusMsg("Uploading image + mask...");
        const { imageName, maskName } = await uploadCanvasAndMask();

        setStatusMsg("Generating inpaint...");
        workflow = api.buildInpaintWorkflow({
          imageName, maskName, positive: effectivePositive, negative,
          seed: actualSeed, steps, cfg,
          denoise: inpaintDenoise,
          shift: DEFAULTS.inpaintShift,
          unetName, clipName, vaeName,
          lora1, lora1Strength, lora2, lora2Strength,
          contextExtendFactor: inpaintContextExtend,
          outputWidth: canvasSize.w,
          outputHeight: canvasSize.h,
          contextOnly: false,
        });
      } else {
        // ---- TXT2IMG ----
        setStatusMsg("Generating...");
        workflow = api.buildTxt2ImgWorkflow({
          positive: effectivePositive, negative,
          width: canvasSize.w, height: canvasSize.h,
          seed: actualSeed, steps, cfg, shift,
          unetName, clipName, vaeName,
          lora1, lora1Strength, lora2, lora2Strength,
          betaAlpha, betaBeta,
        });
      }

      const { prompt_id } = await api.queuePrompt(serverUrl, workflow);
      const outputs = await api.pollForCompletion(serverUrl, prompt_id, {
        steps, onProgress: setProgress, signal: abortControllerRef.current.signal,
      });

      console.log("[Chroma] Generation outputs:", JSON.stringify(Object.keys(outputs)));
      for (const [nodeId, out] of Object.entries(outputs)) {
        if (out.images) console.log(`[Chroma]   Node ${nodeId}: ${out.images.length} image(s) — ${out.images[0]?.filename}`);
      }

      // For inpaint, get node 7 (stitched result), skip node 38 (context preview).
      // For txt2img and upscale, get node 740.
      const preferredNode = isInpaint ? "7" : "740";
      const skipNodes = isInpaint ? ["38"] : [];
      const img = api.findOutputImage(outputs, preferredNode, skipNodes);

      if (img) {
        const imageUrl = api.getImageUrl(serverUrl, img.filename, img.subfolder, img.type);
        if (isUpscale) {
          setCurrentImage(imageUrl); // canvasSize will be synced by the currentImage useEffect
          setCurrentImageFilename(img.filename);
        } else if (!isInpaint) {
          setCurrentImage(imageUrl);
          setCurrentImageFilename(img.filename);
        }
        // Inpaint: result goes to history only — canvas image and mask are preserved
        // so the user can re-run until satisfied, then pick a result from History.
        setGeneratedImages((prev) => [
          { url: imageUrl, filename: img.filename, prompt: positive, timestamp: Date.now(), seed: actualSeed, type: genType },
          ...prev,
        ]);
        if (isInpaint) setActiveTab("History");
        setStatusMsg(genType === "upscale" ? `Upscaled ${upscaleBy}×!` : "Done!");
      } else {
        setStatusMsg("No output image found");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setStatusMsg("Cancelled");
      } else {
        setStatusMsg(`Error: ${err.message}`);
      }
    }
    setGenerating(false);
  }, [
    connected, positive, negative, selectedStyle, seed, steps, cfg, shift, hasMask, currentImage,
    activeTool, serverUrl, canvasSize, unetName, clipName, vaeName,
    lora1, lora1Strength, lora2, lora2Strength,
    betaAlpha, betaBeta, inpaintDenoise, inpaintContextExtend,
    upscaleBy, upscaleTileWidth, upscaleTileHeight, upscaleDenoise,
    uploadCanvasAndMask, uploadCurrentImage,
  ]);

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <div
      style={{
        width: "100vw", height: "100vh",
        display: "flex", flexDirection: "column",
        background: COLORS.bg, color: COLORS.text,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        fontSize: 12, overflow: "hidden", userSelect: "none",
      }}
    >
      <MenuBar connected={connected} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} onGenerate={handleGenerate} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Canvas
            canvasSize={canvasSize} currentImage={currentImage} currentImageFilename={currentImageFilename}
            activeTool={activeTool}
            generating={generating} progress={progress} statusMsg={statusMsg}
            zoom={zoom} setZoom={setZoom} panOffset={panOffset} setPanOffset={setPanOffset}
            maskCanvasRef={maskCanvasRef} hasMask={hasMask} setHasMask={setHasMask}
            onMaskStrokeDone={handleMaskStrokeDone}
            inpaintDenoise={inpaintDenoise} setInpaintDenoise={setInpaintDenoise}
            inpaintContextExtend={inpaintContextExtend} setInpaintContextExtend={setInpaintContextExtend}
            brushSize={brushSize} setBrushSize={setBrushSize}
            onClearMask={handleClearMask}
            onCancel={handleCancel}
            upscaleBy={upscaleBy} setUpscaleBy={setUpscaleBy}
            upscaleTileWidth={upscaleTileWidth} setUpscaleTileWidth={setUpscaleTileWidth}
            upscaleTileHeight={upscaleTileHeight} setUpscaleTileHeight={setUpscaleTileHeight}
            upscaleDenoise={upscaleDenoise} setUpscaleDenoise={setUpscaleDenoise}
          />
          <PromptBar
            positive={positive} setPositive={setPositive}
            negative={negative} setNegative={setNegative}
            onGenerate={handleGenerate} generating={generating}
            hasMask={hasMask} activeTool={activeTool}
            selectedStyle={selectedStyle}
          />
        </div>

        <ConfigPanel
          activeTab={activeTab} setActiveTab={setActiveTab}
          selectedStyle={selectedStyle} setSelectedStyle={setSelectedStyle}
          serverUrl={serverUrl} setServerUrl={setServerUrl}
          connected={connected} checking={checking} onCheckConnection={checkConnection}
          unetName={unetName} setUnetName={setUnetName}
          clipName={clipName} setClipName={setClipName}
          vaeName={vaeName} setVaeName={setVaeName}
          lora1={lora1} setLora1={setLora1}
          lora1Strength={lora1Strength} setLora1Strength={setLora1Strength}
          lora2={lora2} setLora2={setLora2}
          lora2Strength={lora2Strength} setLora2Strength={setLora2Strength}
          availableLoras={availableLoras}
          availableUnets={availableUnets}
          availableClips={availableClips}
          availableVaes={availableVaes}
          canvasSize={canvasSize} setCanvasSize={setCanvasSize}
          steps={steps} setSteps={setSteps} cfg={cfg} setCfg={setCfg}
          shift={shift} setShift={setShift}
          betaAlpha={betaAlpha} setBetaAlpha={setBetaAlpha}
          betaBeta={betaBeta} setBetaBeta={setBetaBeta}
          seed={seed} setSeed={setSeed}
          generatedImages={generatedImages} currentImage={currentImage}
          setCurrentImage={(url, filename) => { setCurrentImage(url); setCurrentImageFilename(filename ?? null); }}
          contextImageUrl={contextImageUrl}
        />
      </div>

      <StatusBar statusMsg={statusMsg} canvasSize={canvasSize} activeTool={activeTool} zoom={zoom} />
    </div>
  );
}
