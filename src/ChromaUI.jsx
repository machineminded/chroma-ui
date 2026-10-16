import { useState, useRef, useEffect, useCallback } from "react";
import * as api from "./api/comfyApi";
import { tools } from "./components/Toolbar";
import { COMFYUI_DEFAULT, CANVAS_SIZES, DEFAULT_CANVAS_INDEX, DEFAULTS, KREA2_DEFAULTS } from "./constants";
import { MODEL_FAMILIES, DEFAULT_FAMILY_ID } from "./workflows";
import { COLORS } from "./styles";
import { DEFAULT_CROP, loadImageSize, renderCrop } from "./utils/crop";

import MenuBar from "./components/MenuBar";
import Toolbar from "./components/Toolbar";
import Canvas from "./components/Canvas";
import PromptBar from "./components/PromptBar";
import ConfigPanel from "./components/ConfigPanel";
import StatusBar from "./components/StatusBar";
import CropEditor from "./components/CropEditor";

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
  // genSize is the size the user wants for the NEXT txt2img generation (controlled by the
  // dropdown). It is intentionally decoupled from canvasSize so that upscaling the canvas
  // does not force the next txt2img to run at the upscaled resolution.
  const [genSize, setGenSize] = useState(CANVAS_SIZES[DEFAULT_CANVAS_INDEX]);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // ---- Generation ----
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Ready");
  const [currentImageFilename, setCurrentImageFilename] = useState(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);

  // ---- Model family (strategy pattern — Chroma vs. Krea2 workflow builders) ----
  const [modelFamilyId, setModelFamilyId] = useState(DEFAULT_FAMILY_ID);
  const family = MODEL_FAMILIES[modelFamilyId];

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
  // Always allocate the max slot count (6, for Krea2); each family only
  // reads/shows the first `family.loraSlots` entries.
  const [loras, setLoras] = useState(
    Array.from({ length: 6 }, () => ({ name: "(none)", strength: 1.0 }))
  );
  const setLoraName = useCallback((i, name) => {
    setLoras((prev) => prev.map((l, idx) => (idx === i ? { ...l, name } : l)));
  }, []);
  const setLoraStrength = useCallback((i, strength) => {
    setLoras((prev) => prev.map((l, idx) => (idx === i ? { ...l, strength } : l)));
  }, []);
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
  // Stable per-tab client ID so ComfyUI's WebSocket progress messages can be
  // correlated with prompts this app queues (see openProgressSocket).
  const clientIdRef = useRef(crypto.randomUUID());

  // ---- Upscale ----
  const [upscaleBy, setUpscaleBy] = useState(DEFAULTS.upscaleBy);
  const [upscaleTileWidth, setUpscaleTileWidth] = useState(DEFAULTS.upscaleTileWidth);
  const [upscaleTileHeight, setUpscaleTileHeight] = useState(DEFAULTS.upscaleTileHeight);
  const [upscaleDenoise, setUpscaleDenoise] = useState(DEFAULTS.upscaleDenoise);

  // ---- Img2Img (families with supportsImg2Img) ----
  const [img2imgEnabled, setImg2imgEnabled] = useState(false);
  const [img2imgDenoise, setImg2imgDenoise] = useState(KREA2_DEFAULTS.img2imgDenoise);
  const [img2imgSource, setImg2imgSource] = useState(null); // { url, w, h, name }
  const [img2imgCrop, setImg2imgCrop] = useState(DEFAULT_CROP);
  const [cropEditorOpen, setCropEditorOpen] = useState(false);

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
        const [loraList, models] = await Promise.all([
          api.fetchLoras(serverUrl),
          api.fetchModels(serverUrl),
        ]);
        setAvailableLoras(loraList);
        setAvailableUnets(models.unets);
        setAvailableClips(models.clips);
        setAvailableVaes(models.vaes);
        setStatusMsg(loraList.length > 0
          ? `Connected — ${loraList.length} LoRA${loraList.length !== 1 ? "s" : ""} found`
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
  // Reset model config to the active family's defaults whenever the family
  // changes — Chroma and Krea2 models/samplers are not interchangeable.
  // ===========================================================================
  useEffect(() => {
    const d = family.defaults;
    setUnetName(d.unetName);
    setClipName(d.clipName);
    setVaeName(d.vaeName);
    setSteps(d.steps);
    setCfg(d.cfg);
    if (d.shift !== undefined) setShift(d.shift);
    if (d.betaAlpha !== undefined) setBetaAlpha(d.betaAlpha);
    if (d.betaBeta !== undefined) setBetaBeta(d.betaBeta);
    setInpaintDenoise(d.inpaintDenoise);
    setInpaintContextExtend(d.inpaintContextExtend);
    if (d.img2imgDenoise !== undefined) setImg2imgDenoise(d.img2imgDenoise);
    setGenSize(family.canvasSizes[family.defaultCanvasIndex]);
  }, [modelFamilyId]);

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
  // Inpaint context preview (called immediately when brush stroke ends)
  // ===========================================================================
  const handleMaskStrokeDone = useCallback(async () => {
    if (!connected || !currentImage) return;
    setStatusMsg("Loading context preview...");

    try {
      const { imageName, maskName } = await uploadCanvasAndMask();

      const workflow = family.buildInpaint({
        imageName, maskName,
        contextExtendFactor: inpaintContextExtend,
        outputWidth: canvasSize.w,
        outputHeight: canvasSize.h,
        contextOnly: true,
        positive: "", negative: "", seed: 0, steps: 8, cfg: 1, denoise: 0.5,
        shift: DEFAULTS.inpaintShift,
        unetName, clipName, vaeName,
        loras: loras.slice(0, family.loraSlots),
      });

      const { prompt_id } = await api.queuePrompt(serverUrl, workflow);
      const outputs = await api.pollForCompletion(serverUrl, prompt_id, { steps: 1, maxAttempts: 30 });

      const ctxImg = api.findOutputImage(outputs, family.outputNodes.inpaint.contextNode);
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
      family, unetName, clipName, vaeName, loras]);

  // Re-run context preview when the context extend factor changes (if mask is active)
  useEffect(() => {
    if (hasMask && currentImage) handleMaskStrokeDone();
  }, [inpaintContextExtend]);

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
  // Img2Img source — from a local file or the current canvas image. The crop
  // resets and the crop editor opens so the user can frame it right away.
  // ===========================================================================
  const setImg2imgSourceFromUrl = useCallback(async (url, name) => {
    try {
      const size = await loadImageSize(url);
      setImg2imgSource((prev) => {
        if (prev?.url.startsWith("blob:") && prev.url !== url) URL.revokeObjectURL(prev.url);
        return { url, name, ...size };
      });
      setImg2imgCrop(DEFAULT_CROP);
      setImg2imgEnabled(true);
      setCropEditorOpen(true);
    } catch (err) {
      setStatusMsg(`Img2Img: ${err.message}`);
    }
  }, []);

  const handleImg2imgLoadFile = useCallback((file) => {
    if (file) setImg2imgSourceFromUrl(URL.createObjectURL(file), file.name);
  }, [setImg2imgSourceFromUrl]);

  const handleImg2imgUseCanvas = useCallback(() => {
    if (currentImage) setImg2imgSourceFromUrl(currentImage, currentImageFilename || "canvas");
  }, [currentImage, currentImageFilename, setImg2imgSourceFromUrl]);

  const handleImg2imgClear = useCallback(() => {
    setImg2imgSource((prev) => {
      if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return null;
    });
    setImg2imgEnabled(false);
  }, []);

  // ===========================================================================
  // Generate (txt2img, img2img, inpaint, or upscale depending on mode)
  // ===========================================================================
  const handleGenerate = useCallback(async () => {
    if (!connected) { setStatusMsg("Not connected to ComfyUI"); return; }
    if (!positive.trim()) { setStatusMsg("Enter a prompt first"); return; }

    const isUpscale = activeTool === "upscale";
    if (isUpscale && !currentImage) { setStatusMsg("Generate an image first before upscaling"); return; }
    if (isUpscale && !family.supportsUpscale) {
      setStatusMsg(`${family.label} doesn't support upscale — try a native high-res size instead`);
      return;
    }

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
        workflow = family.buildUpscale({
          imageName, positive: effectivePositive, negative,
          seed: actualSeed, steps, cfg, shift,
          denoise: upscaleDenoise,
          unetName, clipName, vaeName,
          loras: loras.slice(0, family.loraSlots),
          upscaleBy, tileWidth: upscaleTileWidth, tileHeight: upscaleTileHeight,
          upscaleModelName: DEFAULTS.upscaleModelName,
        });
      } else if (activeTool === "inpaint" && hasMask && currentImage) {
        // ---- INPAINT ----
        isInpaint = true;
        genType = "inpaint";
        setStatusMsg("Uploading image + mask...");
        const { imageName, maskName } = await uploadCanvasAndMask();

        setStatusMsg("Generating inpaint...");
        workflow = family.buildInpaint({
          imageName, maskName, positive: effectivePositive, negative,
          seed: actualSeed, steps, cfg,
          denoise: inpaintDenoise,
          shift: DEFAULTS.inpaintShift,
          unetName, clipName, vaeName,
          loras: loras.slice(0, family.loraSlots),
          contextExtendFactor: inpaintContextExtend,
          outputWidth: canvasSize.w,
          outputHeight: canvasSize.h,
          contextOnly: false,
        });
      } else {
        // ---- TXT2IMG / IMG2IMG ----
        // Img2img reuses the txt2img graph with the empty latent swapped for the
        // encoded source, cropped/scaled client-side to exactly genSize.
        let initImageName;
        if (family.supportsImg2Img && img2imgEnabled) {
          if (!img2imgSource) throw new Error("Img2Img is on but no source image is loaded");
          genType = "img2img";
          setStatusMsg("Uploading img2img source...");
          const blob = await renderCrop(img2imgSource, img2imgCrop, genSize.w, genSize.h);
          initImageName = (await api.uploadImage(serverUrl, blob, "chroma_img2img_source.png")).fullName;
        }

        setStatusMsg("Generating...");
        workflow = family.buildTxt2Img({
          positive: effectivePositive, negative,
          width: genSize.w, height: genSize.h,
          seed: actualSeed, steps, cfg, shift,
          unetName, clipName, vaeName,
          loras: loras.slice(0, family.loraSlots),
          betaAlpha, betaBeta,
          initImageName, denoise: img2imgDenoise,
        });
      }

      const { prompt_id } = await api.queuePrompt(serverUrl, workflow, clientIdRef.current);

      // Real per-step progress from ComfyUI's WebSocket, when available — the
      // time-based estimate below stays as a fallback until (or unless) it
      // delivers a real value.
      let wsHasData = false;
      const closeProgressSocket = api.openProgressSocket(serverUrl, {
        clientId: clientIdRef.current,
        promptId: prompt_id,
        onProgress: (value, max) => {
          wsHasData = true;
          setProgress(Math.min(99, (value / max) * 100));
        },
      });

      let outputs;
      try {
        outputs = await api.pollForCompletion(serverUrl, prompt_id, {
          steps,
          onProgress: (pct) => { if (!wsHasData) setProgress(pct); },
          signal: abortControllerRef.current.signal,
        });
      } finally {
        closeProgressSocket();
      }

      console.log("[Chroma] Generation outputs:", JSON.stringify(Object.keys(outputs)));
      for (const [nodeId, out] of Object.entries(outputs)) {
        if (out.images) console.log(`[Chroma]   Node ${nodeId}: ${out.images.length} image(s) — ${out.images[0]?.filename}`);
      }

      // For inpaint, get the stitched result node, skipping the context preview node.
      // For txt2img and upscale, get the family's txt2img output node.
      const preferredNode = isInpaint ? family.outputNodes.inpaint.node : family.outputNodes.txt2img.node;
      const skipNodes = isInpaint ? family.outputNodes.inpaint.skip : [];
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
    activeTool, serverUrl, canvasSize, genSize, unetName, clipName, vaeName,
    family, loras,
    betaAlpha, betaBeta, inpaintDenoise, inpaintContextExtend,
    upscaleBy, upscaleTileWidth, upscaleTileHeight, upscaleDenoise,
    img2imgEnabled, img2imgSource, img2imgCrop, img2imgDenoise,
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
        <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} onGenerate={handleGenerate}
          disabledTools={family.supportsUpscale ? [] : ["upscale"]} />

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
          modelFamilyId={modelFamilyId} setModelFamilyId={setModelFamilyId} family={family}
          unetName={unetName} setUnetName={setUnetName}
          clipName={clipName} setClipName={setClipName}
          vaeName={vaeName} setVaeName={setVaeName}
          loras={loras} setLoraName={setLoraName} setLoraStrength={setLoraStrength}
          availableLoras={availableLoras}
          availableUnets={availableUnets}
          availableClips={availableClips}
          availableVaes={availableVaes}
          genSize={genSize} setGenSize={setGenSize}
          steps={steps} setSteps={setSteps} cfg={cfg} setCfg={setCfg}
          shift={shift} setShift={setShift}
          betaAlpha={betaAlpha} setBetaAlpha={setBetaAlpha}
          betaBeta={betaBeta} setBetaBeta={setBetaBeta}
          seed={seed} setSeed={setSeed}
          generatedImages={generatedImages} currentImage={currentImage}
          setCurrentImage={(url, filename) => { setCurrentImage(url); setCurrentImageFilename(filename ?? null); }}
          contextImageUrl={contextImageUrl}
          img2img={{
            enabled: img2imgEnabled, setEnabled: setImg2imgEnabled,
            denoise: img2imgDenoise, setDenoise: setImg2imgDenoise,
            source: img2imgSource, crop: img2imgCrop,
            canUseCanvas: !!currentImage,
            onLoadFile: handleImg2imgLoadFile,
            onUseCanvas: handleImg2imgUseCanvas,
            onClear: handleImg2imgClear,
            onEditCrop: () => setCropEditorOpen(true),
          }}
        />
      </div>

      <StatusBar statusMsg={statusMsg} canvasSize={canvasSize} activeTool={activeTool} zoom={zoom} />

      {cropEditorOpen && img2imgSource && (
        <CropEditor
          source={img2imgSource} crop={img2imgCrop}
          targetW={genSize.w} targetH={genSize.h}
          onChange={setImg2imgCrop}
          onClose={() => setCropEditorOpen(false)}
        />
      )}
    </div>
  );
}
