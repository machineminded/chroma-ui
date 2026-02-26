import { COLORS } from "../styles";

export default function StatusBar({ statusMsg, canvasSize, activeTool, zoom }) {
  return (
    <div
      style={{
        height: 24,
        background: COLORS.bgDark,
        borderTop: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 16,
        fontSize: 10,
        color: COLORS.textDimmer,
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
  );
}
