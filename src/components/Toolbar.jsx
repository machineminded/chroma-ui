import Icons from "./Icons";
import { COLORS } from "../styles";

const tools = [
  { id: "pointer", icon: Icons.Pointer, label: "Text to Image (V)", shortcut: "v" },
  { id: "inpaint", icon: Icons.Inpaint, label: "Inpaint Mask (I)", shortcut: "i" },
  { id: "upscale", icon: Icons.Upscale, label: "Upscale (U)", shortcut: "u" },
];

export { tools };

export default function Toolbar({ activeTool, setActiveTool, onGenerate }) {
  const toolbarW = 44;

  return (
    <div
      style={{
        width: toolbarW,
        background: COLORS.bgDark,
        borderRight: `1px solid ${COLORS.border}`,
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
            width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", borderRadius: 4, cursor: "pointer",
            background: activeTool === t.id ? "#a78bfa22" : "transparent",
            color: activeTool === t.id ? COLORS.accent : "#777",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { if (activeTool !== t.id) e.currentTarget.style.background = "#ffffff08"; }}
          onMouseLeave={(e) => { if (activeTool !== t.id) e.currentTarget.style.background = "transparent"; }}
        >
          <t.icon />
        </button>
      ))}

      <div style={{ height: 1, width: 24, background: COLORS.border, margin: "6px 0" }} />

      <button
        title="Generate"
        onClick={onGenerate}
        style={{
          width: 34, height: 34,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", borderRadius: 4, cursor: "pointer",
          background: "transparent",
          color: COLORS.accent,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Icons.Generate />
      </button>
    </div>
  );
}
