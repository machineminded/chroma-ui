import Icons from "./Icons";
import { COLORS } from "../styles";

export default function MenuBar({ connected }) {
  return (
    <div
      style={{
        height: 32,
        background: COLORS.bgDark,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 16,
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 700, color: COLORS.accent, letterSpacing: 2, fontSize: 13, textTransform: "uppercase" }}>
        ◆ Chroma
      </span>
      <span style={{ color: COLORS.textDimmer, fontSize: 11 }}>|</span>
      {["File", "Edit", "View", "Image", "Generate"].map((m) => (
        <span
          key={m}
          style={{ cursor: "pointer", padding: "2px 6px", borderRadius: 3, fontSize: 11, color: COLORS.textDim }}
          onMouseEnter={(e) => (e.target.style.color = "#ccc")}
          onMouseLeave={(e) => (e.target.style.color = COLORS.textDim)}
        >
          {m}
        </span>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {connected ? <Icons.Connected /> : <Icons.Disconnected />}
        <span style={{ fontSize: 10, color: connected ? COLORS.success : COLORS.danger }}>
          {connected ? "ComfyUI" : "Offline"}
        </span>
      </div>
    </div>
  );
}
