import Icons from "./Icons";
import { COLORS, labelStyle, inputStyle, sliderStyle, valStyle, dividerStyle, sectionHeaderStyle, selectStyle } from "../styles";
import { CANVAS_SIZES } from "../constants";
import StylesPanel from "./StylesPanel";

export default function ConfigPanel({
  // Tab state
  activeTab, setActiveTab,
  // Connection
  serverUrl, setServerUrl, connected, checking, onCheckConnection,
  // Model
  unetName, setUnetName, clipName, setClipName, vaeName, setVaeName,
  // LoRA
  lora1, setLora1, lora1Strength, setLora1Strength,
  lora2, setLora2, lora2Strength, setLora2Strength,
  availableLoras,
  // Sampling
  canvasSize, setCanvasSize, steps, setSteps, cfg, setCfg,
  shift, setShift, betaAlpha, setBetaAlpha, betaBeta, setBetaBeta,
  seed, setSeed,
  // Styles
  selectedStyle, setSelectedStyle,
  // History
  generatedImages, currentImage, setCurrentImage,
  // Inpaint context preview
  contextImageUrl,
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
            unetName={unetName} setUnetName={setUnetName}
            clipName={clipName} setClipName={setClipName}
            vaeName={vaeName} setVaeName={setVaeName}
            lora1={lora1} setLora1={setLora1} lora1Strength={lora1Strength} setLora1Strength={setLora1Strength}
            lora2={lora2} setLora2={setLora2} lora2Strength={lora2Strength} setLora2Strength={setLora2Strength}
            availableLoras={availableLoras}
            canvasSize={canvasSize} setCanvasSize={setCanvasSize}
            steps={steps} setSteps={setSteps} cfg={cfg} setCfg={setCfg}
            shift={shift} setShift={setShift}
            betaAlpha={betaAlpha} setBetaAlpha={setBetaAlpha}
            betaBeta={betaBeta} setBetaBeta={setBetaBeta}
            seed={seed} setSeed={setSeed}
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
          />
        )}
      </div>
    </div>
  );
}

// ---------- Config Tab ----------
function ConfigTab({
  serverUrl, setServerUrl, connected, checking, onCheckConnection,
  unetName, setUnetName, clipName, setClipName, vaeName, setVaeName,
  lora1, setLora1, lora1Strength, setLora1Strength,
  lora2, setLora2, lora2Strength, setLora2Strength,
  availableLoras,
  canvasSize, setCanvasSize,
  steps, setSteps, cfg, setCfg, shift, setShift,
  betaAlpha, setBetaAlpha, betaBeta, setBetaBeta,
  seed, setSeed,
}) {
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

      {/* Model */}
      <div style={sectionHeaderStyle}>Model</div>
      <div>
        <label style={labelStyle}>UNET / Diffusion Model</label>
        <input value={unetName} onChange={(e) => setUnetName(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
      </div>
      <div>
        <label style={labelStyle}>CLIP (T5)</label>
        <input value={clipName} onChange={(e) => setClipName(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
      </div>
      <div>
        <label style={labelStyle}>VAE</label>
        <input value={vaeName} onChange={(e) => setVaeName(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
      </div>

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
      <LoraSelect label="LoRA 1" value={lora1} onChange={setLora1} strength={lora1Strength} onStrengthChange={setLora1Strength} loras={availableLoras} />
      <LoraSelect label="LoRA 2" value={lora2} onChange={setLora2} strength={lora2Strength} onStrengthChange={setLora2Strength} loras={availableLoras} />

      <div style={dividerStyle} />

      {/* Sampling */}
      <div style={sectionHeaderStyle}>Sampling</div>

      <div>
        <label style={labelStyle}>Canvas Size</label>
        <select
          value={`${canvasSize.w}x${canvasSize.h}`}
          onChange={(e) => { const [w, h] = e.target.value.split("x").map(Number); setCanvasSize({ label: `${w} × ${h}`, w, h }); }}
          style={selectStyle}
        >
          {CANVAS_SIZES.map((s) => <option key={s.label} value={`${s.w}x${s.h}`}>{s.label}</option>)}
        </select>
      </div>

      <SliderRow label="Steps" value={steps} onChange={setSteps} min={1} max={80} step={1} />
      <SliderRow label="CFG" value={cfg} onChange={setCfg} min={0} max={20} step={0.5} decimals={1} />
      <SliderRow label="Flow Shift" value={shift} onChange={setShift} min={0} max={10} step={0.1} decimals={1} />

      <div style={dividerStyle} />

      <div style={sectionHeaderStyle}>Beta Scheduler</div>
      <SliderRow label="Alpha" value={betaAlpha} onChange={setBetaAlpha} min={0.01} max={2} step={0.01} decimals={2} />
      <SliderRow label="Beta" value={betaBeta} onChange={setBetaBeta} min={0.01} max={2} step={0.01} decimals={2} />

      {/* Seed */}
      <div>
        <label style={labelStyle}>Seed <span style={{ color: COLORS.textDimmer }}>(-1 = random)</span></label>
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))}
          style={{ ...inputStyle, width: "100%", marginTop: 4, boxSizing: "border-box" }} />
      </div>
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

function HistoryTab({ generatedImages, currentImage, setCurrentImage, contextImageUrl }) {
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
              <span>{img.type === "inpaint" ? "Inpaint" : img.type === "upscale" ? "Upscale" : "txt2img"} · Seed: {img.seed}</span>
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

// ---------- Reusable LoRA selector ----------
function LoraSelect({ label, value, onChange, strength, onStrengthChange, loras }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="(none)">(none)</option>
        {loras.map((l) => <option key={l} value={l}>{l.replace(/\.[^.]+$/, "")}</option>)}
      </select>
      {value && value !== "(none)" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: COLORS.textDimmer }}>Strength</span>
            <span style={valStyle}>{strength.toFixed(2)}</span>
          </div>
          <input type="range" min={-4} max={4} step={0.05} value={strength}
            onChange={(e) => onStrengthChange(Number(e.target.value))} style={sliderStyle} />
        </>
      )}
    </div>
  );
}
