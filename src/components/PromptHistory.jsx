import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, inputStyle } from "../styles";

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Searchable popover of previously generated prompts, newest first (starred
 * entries pinned to the top). Click an entry to load it into the active tab.
 */
export default function PromptHistory({ history, onLoad, onOpenInNewTab, onToggleStar, onDelete, onClear, onClose }) {
  const [query, setQuery] = useState("");
  // Clear is two-click: the first click arms it, moving the mouse away disarms it
  const [confirmClear, setConfirmClear] = useState(false);
  const clearableCount = history.filter((h) => !h.starred).length;
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
    const onDocMouseDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) onClose(); };
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = history.filter((h) =>
      !q || h.positive.toLowerCase().includes(q) || (h.negative || "").toLowerCase().includes(q)
        || (h.style?.name || "").toLowerCase().includes(q)
    );
    return [...matches.filter((h) => h.starred), ...matches.filter((h) => !h.starred)];
  }, [history, query]);

  const iconButton = (active) => ({
    background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px",
    fontSize: 12, fontFamily: "inherit", color: active ? "#f59e0b" : COLORS.textDimmer, lineHeight: 1,
  });

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 30, width: 460,
        maxHeight: 420, display: "flex", flexDirection: "column",
        background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`, borderRadius: 6,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompt history..." style={inputStyle} />
        <span style={{ fontSize: 9, color: COLORS.textDimmer, whiteSpace: "nowrap" }}>{history.length} saved</span>
        <button
          disabled={clearableCount === 0}
          onClick={() => {
            if (!confirmClear) return setConfirmClear(true);
            onClear();
            setConfirmClear(false);
          }}
          onMouseLeave={() => setConfirmClear(false)}
          title="Remove all unstarred prompts (starred ones are kept)"
          style={{
            background: confirmClear ? "#ef444422" : "transparent",
            border: `1px solid ${confirmClear ? "#ef4444" : COLORS.border}`, borderRadius: 4,
            padding: "3px 8px", fontSize: 10, fontFamily: "inherit", whiteSpace: "nowrap",
            color: confirmClear ? "#ef4444" : COLORS.textDimmer,
            cursor: clearableCount === 0 ? "default" : "pointer", opacity: clearableCount === 0 ? 0.4 : 1,
          }}
        >
          {confirmClear ? `Clear ${clearableCount}?` : "Clear"}
        </button>
      </div>

      <div style={{ overflowY: "auto" }}>
        {entries.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: COLORS.textDimmer, textAlign: "center" }}>
            {history.length === 0 ? "Prompts you generate with will show up here." : "No matches"}
          </div>
        )}
        {entries.map((h) => (
          <div
            key={h.id}
            onClick={() => { onLoad(h); onClose(); }}
            title="Load into the current prompt tab"
            style={{ padding: "7px 10px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", display: "flex", gap: 8 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: COLORS.text, overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word",
              }}>
                {h.positive}
              </div>
              <div style={{ fontSize: 9, color: COLORS.textDimmer, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {timeAgo(h.timestamp)}
                {h.style && <span style={{ color: COLORS.accent }}> · {h.style.name}</span>}
                {h.negative && <span style={{ color: "#ef444499" }}> · − {h.negative}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onToggleStar(h.id)} title={h.starred ? "Unstar" : "Star (never auto-removed)"}
                style={iconButton(h.starred)}>{h.starred ? "★" : "☆"}</button>
              <button onClick={() => { onOpenInNewTab(h); onClose(); }} title="Open in a new prompt tab"
                style={iconButton(false)}>⧉</button>
              <button onClick={() => onDelete(h.id)} title="Remove from history"
                style={iconButton(false)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
