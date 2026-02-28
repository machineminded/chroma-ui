import { COLORS } from "../styles";

export default function PromptBar({ positive, setPositive, negative, setNegative, onGenerate, generating, hasMask, activeTool, selectedStyle }) {
  const buttonLabel = generating ? "..." : activeTool === "upscale" ? "Upscale" : hasMask ? "Inpaint" : "Generate";
  return (
    <div
      style={{
        background: COLORS.bgMid,
        borderTop: `1px solid ${COLORS.border}`,
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flexShrink: 0,
      }}
    >
      {/* Positive prompt */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 10, color: COLORS.accent, minWidth: 24, paddingTop: 6, fontWeight: 600 }}>+</span>
        <textarea
          value={positive}
          onChange={(e) => setPositive(e.target.value)}
          placeholder="Describe your image... (positive prompt)"
          rows={3}
          style={{
            flex: 1, background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`, borderRadius: 6,
            color: "#ddd", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
            resize: "vertical", outline: "none", minHeight: 56,
          }}
          onFocus={(e) => (e.target.style.borderColor = "#a78bfa55")}
          onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
        />
        <button
          onClick={onGenerate}
          disabled={generating || !positive.trim()}
          style={{
            padding: "8px 20px", height: 36,
            background: generating ? "#333" : `linear-gradient(135deg, ${COLORS.accentDark}, ${COLORS.accent})`,
            border: "none", borderRadius: 6, color: "#fff", fontWeight: 700,
            cursor: generating ? "wait" : "pointer", fontSize: 12, fontFamily: "inherit",
            letterSpacing: 1, textTransform: "uppercase",
            opacity: !positive.trim() ? 0.4 : 1,
            transition: "all 0.2s",
            boxShadow: generating ? "none" : "0 0 20px rgba(167,139,250,0.2)",
            whiteSpace: "nowrap",
          }}
        >
          {buttonLabel}
        </button>
      </div>
      {/* Active style badge */}
      {selectedStyle && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 32 }}>
          <span style={{
            fontSize: 10, color: COLORS.accent,
            background: "#a78bfa18", border: `1px solid #a78bfa33`,
            borderRadius: 4, padding: "2px 8px",
          }}>
            Style: {selectedStyle.name}
          </span>
        </div>
      )}
      {/* Negative prompt */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 10, color: COLORS.danger, minWidth: 24, paddingTop: 6, fontWeight: 600 }}>−</span>
        <textarea
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
          placeholder="What to avoid... (negative prompt)"
          rows={1}
          style={{
            flex: 1, background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`, borderRadius: 6,
            color: "#ddd", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
            resize: "vertical", outline: "none", minHeight: 28,
          }}
          onFocus={(e) => (e.target.style.borderColor = "#ef444455")}
          onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
        />
      </div>
    </div>
  );
}
