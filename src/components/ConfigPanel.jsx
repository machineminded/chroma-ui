import { useEffect, useMemo, useRef, useState } from "react";
import Icons from "./Icons";
import { COLORS, labelStyle, inputStyle, sliderStyle, valStyle, dividerStyle, sectionHeaderStyle, selectStyle } from "../styles";
import { MODEL_FAMILIES } from "../workflows";
import StylesPanel from "./StylesPanel";
import { CropPreview } from "./CropEditor";

export default function ConfigPanel({
  // Tab state
  activeTab, setActiveTab,
  // Connection
  serverUrl, setServerUrl, connected, checking, onCheckConnection,
  // Model family (strategy pattern)
  modelFamilyId, setModelFamilyId, family,
  // Model
  unetName, setUnetName, clipName, setClipName, vaeName, setVaeName,
  // LoRA
  loras, setLoraName, setLoraStrength,
  availableLoras,
  // Model lists
  availableUnets, availableClips, availableVaes,
  // Sampling
  genSize, setGenSize, steps, setSteps, cfg, setCfg,
  shift, setShift, betaAlpha, setBetaAlpha, betaBeta, setBetaBeta,
  seed, setSeed,
  // Styles
  selectedStyle, setSelectedStyle,
  // History
  generatedImages, currentImage, setCurrentImage,
  // Inpaint context preview
  contextImageUrl,
  // Reuse a generated image's prompt in the active prompt tab
  onUsePrompt,
  // Img2Img
  img2img,
}) {
  const sideW = 260;

  return (
    <div
      style={{
        width: sideW,
        background: COLORS.bgDark,
        borderLeft: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgDarker }}>
        {[
          { icon: Icons.Settings, label: "Config" },
          { icon: Icons.Styles, label: "Styles" },
          { icon: Icons.History, label: "History" },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.label)}
            style={{
              flex: 1, padding: "8px 0", border: "none", background: "transparent",
              color: activeTab === tab.label ? COLORS.accent : COLORS.textDimmer,
              cursor: "pointer", fontSize: 10, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 2, fontFamily: "inherit",
              borderBottom: activeTab === tab.label ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            }}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {activeTab === "Config" && (
          <ConfigTab
            serverUrl={serverUrl} setServerUrl={setServerUrl}
            connected={connected} checking={checking} onCheckConnection={onCheckConnection}
            modelFamilyId={modelFamilyId} setModelFamilyId={setModelFamilyId} family={family}
            unetName={unetName} setUnetName={setUnetName}
            clipName={clipName} setClipName={setClipName}
            vaeName={vaeName} setVaeName={setVaeName}
            loras={loras} setLoraName={setLoraName} setLoraStrength={setLoraStrength}
            availableLoras={availableLoras}
            availableUnets={availableUnets} availableClips={availableClips} availableVaes={availableVaes}
            genSize={genSize} setGenSize={setGenSize}
            steps={steps} setSteps={setSteps} cfg={cfg} setCfg={setCfg}
            shift={shift} setShift={setShift}
            betaAlpha={betaAlpha} setBetaAlpha={setBetaAlpha}
            betaBeta={betaBeta} setBetaBeta={setBetaBeta}
            seed={seed} setSeed={setSeed}
            img2img={img2img}
          />
        )}

        {activeTab === "Styles" && (
          <StylesPanel selectedStyle={selectedStyle} setSelectedStyle={setSelectedStyle} />
        )}

        {activeTab === "History" && (
          <HistoryTab
            generatedImages={generatedImages}
            currentImage={currentImage}
            setCurrentImage={setCurrentImage}
            contextImageUrl={contextImageUrl}
            onUsePrompt={onUsePrompt}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Config Tab ----------
function ConfigTab({
  serverUrl, setServerUrl, connected, checking, onCheckConnection,
  modelFamilyId, setModelFamilyId, family,
  unetName, setUnetName, clipName, setClipName, vaeName, setVaeName,
  loras, setLoraName, setLoraStrength,
  availableLoras, availableUnets, availableClips, availableVaes,
  genSize, setGenSize,
  steps, setSteps, cfg, setCfg, shift, setShift,
  betaAlpha, setBetaAlpha, betaBeta, setBetaBeta,
  seed, setSeed,
  img2img,
}) {
  const isChroma = family.id === "chroma";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Connection */}
      <div>
        <label style={labelStyle}>ComfyUI Server</label>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} style={inputStyle} />
          <button
            onClick={onCheckConnection} disabled={checking}
            style={{
              background: COLORS.border, border: "none", borderRadius: 4, color: "#aaa",
              padding: "4px 10px", cursor: "pointer", fontSize: 10, fontFamily: "inherit",
            }}
          >
            {checking ? "..." : "Test"}
          </button>
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Model Family */}
      <div>
        <label style={labelStyle}>Model Family</label>
        <select
          value={modelFamilyId}
          onChange={(e) => setModelFamilyId(e.target.value)}
          style={selectStyle}
        >
          {Object.values(MODEL_FAMILIES).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      <div style={dividerStyle} />

      {/* Model */}
      <div style={sectionHeaderStyle}>Model</div>
      <ModelSelect label="UNET / Diffusion Model" value={unetName} onChange={setUnetName} models={availableUnets} />
      <ModelSelect label="CLIP" value={clipName} onChange={setClipName} models={availableClips} />
      <ModelSelect label="VAE" value={vaeName} onChange={setVaeName} models={availableVaes} />

      <div style={dividerStyle} />

      {/* LoRA */}
      <div style={sectionHeaderStyle}>
        LoRA
        {availableLoras.length > 0 && (
          <span style={{ fontWeight: 400, color: COLORS.textDimmer, marginLeft: 6, fontSize: 9, textTransform: "none", letterSpacing: 0 }}>
            ({availableLoras.length} available)
          </span>
        )}
      </div>
      {Array.from({ length: family.loraSlots }, (_, i) => (
        <LoraSelect
          key={i}
          label={`LoRA ${i + 1}`}
          value={loras[i].name}
          onChange={(v) => setLoraName(i, v)}
          strength={loras[i].strength}
          onStrengthChange={(v) => setLoraStrength(i, v)}
          loras={availableLoras}
        />
      ))}

      <div style={dividerStyle} />

      {/* Sampling */}
      <div style={sectionHeaderStyle}>Sampling</div>

      <div>
        <label style={labelStyle}>Generation Size</label>
        <select
          value={`${genSize.w}x${genSize.h}`}
          onChange={(e) => { const [w, h] = e.target.value.split("x").map(Number); setGenSize({ label: `${w} × ${h}`, w, h }); }}
          style={selectStyle}
        >
          {family.canvasSizes.map((s) => <option key={s.label} value={`${s.w}x${s.h}`}>{s.label}</option>)}
        </select>
      </div>

      {family.supportsImg2Img && <Img2ImgSection img2img={img2img} genSize={genSize} />}

      <SliderRow label="Steps" value={steps} onChange={setSteps} min={1} max={80} step={1} />
      <SliderRow label="CFG" value={cfg} onChange={setCfg} min={0} max={20} step={0.5} decimals={1} />
      {isChroma && (
        <SliderRow label="Flow Shift" value={shift} onChange={setShift} min={0} max={10} step={0.1} decimals={1} />
      )}

      {isChroma && (
        <>
          <div style={dividerStyle} />
          <div style={sectionHeaderStyle}>Beta Scheduler</div>
          <SliderRow label="Alpha" value={betaAlpha} onChange={setBetaAlpha} min={0.01} max={2} step={0.01} decimals={2} />
          <SliderRow label="Beta" value={betaBeta} onChange={setBetaBeta} min={0.01} max={2} step={0.01} decimals={2} />
        </>
      )}

      {/* Seed */}
      <div>
        <label style={labelStyle}>Seed <span style={{ color: COLORS.textDimmer }}>(-1 = random)</span></label>
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
          style={{ ...inputStyle, width: "100%", marginTop: 4, boxSizing: "border-box" }} />
      </div>
    </div>
  );
}

// ---------- Img2Img: source image, crop preview, denoise ----------
function Img2ImgSection({ img2img, genSize }) {
  const { enabled, setEnabled, denoise, setDenoise, source, crop, canUseCanvas,
    onLoadFile, onUseCanvas, onClear, onEditCrop } = img2img;
  const fileInputRef = useRef(null);

  const smallButton = (disabled) => ({
    flex: 1, background: COLORS.border, border: "none", borderRadius: 4,
    color: disabled ? COLORS.textDimmest : "#aaa", padding: "4px 6px",
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "inherit",
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 6,
      border: `1px solid ${enabled ? "#a78bfa44" : COLORS.border}`,
      background: enabled ? "#a78bfa0a" : "transparent",
    }}>
      <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
          style={{ accentColor: COLORS.accent, margin: 0 }} />
        Image to Image
      </label>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { onLoadFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => fileInputRef.current?.click()} style={smallButton(false)}>Load File…</button>
        <button onClick={onUseCanvas} disabled={!canUseCanvas} style={smallButton(!canUseCanvas)}
          title={canUseCanvas ? "Use the image currently on the canvas" : "No image on the canvas"}>
          Use Canvas
        </button>
      </div>

      {source && (
        <>
          <CropPreview source={source} crop={crop} targetW={genSize.w} targetH={genSize.h}
            width={218} onClick={onEditCrop} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: COLORS.textDimmer, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {source.w} × {source.h} → {genSize.w} × {genSize.h}
            </span>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button onClick={onEditCrop} style={{ ...smallButton(false), flex: "none" }}>Crop…</button>
              <button onClick={onClear} style={{ ...smallButton(false), flex: "none", color: COLORS.danger }}>Remove</button>
            </div>
          </div>
        </>
      )}

      {enabled && (
        <SliderRow label="Denoise" value={denoise} onChange={setDenoise} min={0} max={1} step={0.01} decimals={2} />
      )}
    </div>
  );
}

// ---------- History Tab ----------
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

function HistoryTab({ generatedImages, currentImage, setCurrentImage, contextImageUrl, onUsePrompt }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Context image preview */}
      {contextImageUrl && (
        <>
          <div style={sectionHeaderStyle}>Inpaint Context</div>
          <div style={{
            background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`,
            borderRadius: 6, padding: 6, marginBottom: 4,
          }}>
            <img src={contextImageUrl} alt="context" style={{
              width: "100%", borderRadius: 4, display: "block",
            }} />
            <div style={{ fontSize: 9, color: COLORS.textDimmest, marginTop: 4 }}>
              Cropped region that will be inpainted
            </div>
          </div>
          <div style={dividerStyle} />
        </>
      )}

      <div style={sectionHeaderStyle}>Generated</div>
      {generatedImages.length === 0 ? (
        <div style={{ color: COLORS.textDimmest, fontSize: 11, textAlign: "center", padding: 20 }}>
          No images generated yet.<br />
          <span style={{ color: COLORS.textDimmer, fontSize: 10 }}>Enter a prompt and click Generate.</span>
        </div>
      ) : (
        generatedImages.map((img, i) => (
          <div
            key={i}
            onClick={() => setCurrentImage(img.url, img.filename)}
            style={{
              background: currentImage === img.url ? "#a78bfa15" : COLORS.bgDarker,
              border: `1px solid ${currentImage === img.url ? "#a78bfa44" : COLORS.border}`,
              borderRadius: 6, padding: 6, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <img src={img.url} alt="" style={{
              width: "100%", height: 120, objectFit: "cover", borderRadius: 4, display: "block",
            }} />
            <div style={{ fontSize: 10, color: "#777", marginTop: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {img.prompt}
            </div>
            <div style={{ fontSize: 9, color: COLORS.textDimmest, marginTop: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {img.tabName ? `${img.tabName} · ` : ""}
                {img.type === "inpaint" ? "Inpaint" : img.type === "upscale" ? "Upscale" : img.type === "img2img" ? "img2img" : "txt2img"} · Seed: {img.seed}
              </span>
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onUsePrompt?.({ positive: img.prompt, negative: img.negative, style: img.style }); }}
                  title="Use this prompt in the current prompt tab"
                  style={{
                    background: "transparent", border: "none", color: COLORS.textDimmer,
                    cursor: "pointer", padding: "2px 4px", fontSize: 11, fontFamily: "inherit",
                  }}
                >
                  ↺
                </button>
                {img.filename && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadImage(img.url, img.filename); }}
                    title={`Download ${img.filename}`}
                    style={{
                      background: "transparent", border: "none", color: COLORS.textDimmer,
                      cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center",
                    }}
                  >
                    <Icons.Download />
                  </button>
                )}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------- Reusable slider row ----------
function SliderRow({ label, value, onChange, min, max, step, decimals = 0 }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={labelStyle}>{label}</label>
        <span style={valStyle}>{decimals > 0 ? value.toFixed(decimals) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={sliderStyle} />
    </div>
  );
}

// ---------- Reusable model selector ----------
function ModelSelect({ label, value, onChange, models }) {
  if (models.length === 0) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input value={value} onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
      </div>
    );
  }
  const options = models.includes(value) ? models : [value, ...models];
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((m) => <option key={m} value={m}>{m.replace(/\.[^.]+$/, "")}</option>)}
      </select>
    </div>
  );
}

// ---------- Reusable LoRA selector (searchable) ----------
function LoraSelect({ label, value, onChange, strength, onStrengthChange, loras }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={loras}
        noneLabel="(none)"
        placeholder="Search LoRAs..."
        formatOption={(l) => l.replace(/\.[^.]+$/, "")}
      />
      {value && value !== "(none)" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 6 }}>
            <span style={{ fontSize: 10, color: COLORS.textDimmer }}>Strength</span>
            <StrengthInput strength={strength} onStrengthChange={onStrengthChange} />
          </div>
          <input type="range" min={-4} max={4} step={0.05} value={strength}
            onChange={(e) => onStrengthChange(Number(e.target.value))} style={sliderStyle} />
        </>
      )}
    </div>
  );
}

// ---------- LoRA strength text input (allows typing "-" / partial decimals) ----------
function StrengthInput({ strength, onStrengthChange }) {
  const [draft, setDraft] = useState(strength.toFixed(2));

  useEffect(() => {
    // Keep the field in sync when strength changes externally (e.g. via the slider)
    if (parseFloat(draft) !== strength) setDraft(strength.toFixed(2));
  }, [strength]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^-?\d*\.?\d*$/.test(raw)) return;
        setDraft(raw);
        const v = parseFloat(raw);
        if (!Number.isNaN(v)) onStrengthChange(Math.min(4, Math.max(-4, v)));
      }}
      onBlur={() => setDraft(strength.toFixed(2))}
      style={{ ...inputStyle, width: 56, textAlign: "right", padding: "2px 4px" }}
    />
  );
}

// ---------- Reusable searchable dropdown (select-with-a-filter-box) ----------
function SearchableSelect({ value, onChange, options, noneLabel = "(none)", placeholder = "Search...", formatOption = (v) => v }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Focus after the panel actually mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesNone = noneLabel.toLowerCase().includes(q);
    const opts = options.filter((o) => o.toLowerCase().includes(q));
    return { matchesNone, opts };
  }, [options, query, noneLabel]);

  const select = (v) => { onChange(v); setOpen(false); };
  const displayLabel = !value || value === "(none)" ? noneLabel : formatOption(value);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...selectStyle, textAlign: "left", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayLabel}</span>
        <span style={{ color: COLORS.textDimmer, marginLeft: 6, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`,
            borderRadius: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            display: "flex", flexDirection: "column", maxHeight: 240, overflow: "hidden",
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{ ...inputStyle, margin: 4, width: "auto" }}
          />
          <div style={{ overflowY: "auto" }}>
            {filtered.matchesNone && (
              <SearchableOption label={noneLabel} selected={!value || value === "(none)"} onClick={() => select("(none)")} />
            )}
            {filtered.opts.map((o) => (
              <SearchableOption key={o} label={formatOption(o)} selected={value === o} onClick={() => select(o)} />
            ))}
            {!filtered.matchesNone && filtered.opts.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 10, color: COLORS.textDimmer }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableOption({ label, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 10px", fontSize: 11, cursor: "pointer",
        color: selected ? COLORS.accent : COLORS.text,
        background: selected ? "#a78bfa15" : "transparent",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "#ffffff08"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </div>
  );
}
