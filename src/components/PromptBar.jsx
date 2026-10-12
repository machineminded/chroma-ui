import { useState } from "react";
import { COLORS } from "../styles";
import Icons from "./Icons";
import PromptHistory from "./PromptHistory";

export default function PromptBar({
  positive, setPositive, negative, setNegative, onGenerate, generating, hasMask, activeTool, selectedStyle,
  // Prompt tabs
  promptTabs, activePromptTabId, onSelectTab, onAddTab, onCloseTab, onRenameTab, onGenerateAll,
  // Prompt history
  promptHistory, onLoadHistory, onOpenHistoryInNewTab, onToggleHistoryStar, onDeleteHistory,
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const buttonLabel = generating ? "..." : activeTool === "upscale" ? "Upscale" : hasMask ? "Inpaint" : "Generate";
  const runnableTabs = promptTabs.filter((t) => t.positive.trim()).length;
  const canGenerateAll = !generating && activeTool !== "upscale" && runnableTabs > 0;

  function makeKeyDownHandler(value, setValue) {
    return function handleKeyDown(e) {
      // Alt+1..9 jumps to prompt tab N (Ctrl+Tab is reserved by the browser)
      if (e.altKey && !e.ctrlKey && /^[1-9]$/.test(e.key)) {
        const tab = promptTabs[Number(e.key) - 1];
        if (tab) { e.preventDefault(); onSelectTab(tab.id); }
        return;
      }
      if (e.key === "Enter" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (canGenerateAll) onGenerateAll();
        return;
      }
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        if (!generating && positive.trim()) onGenerate();
        return;
      }
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.ctrlKey) {
        const textarea = e.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) return;

        e.preventDefault();
        const delta = e.key === "ArrowUp" ? 0.05 : -0.05;
        const selected = value.slice(start, end);

        // Already weighted? e.g. (butterfly:1.05)
        const match = selected.match(/^\((.+):(\d+(?:\.\d+)?)\)$/);
        const innerText = match ? match[1] : selected;
        const currentWeight = match ? parseFloat(match[2]) : 1.0;
        const newWeight = Math.max(0.05, Math.round((currentWeight + delta) * 100) / 100);
        const newText = newWeight === 1.0 ? innerText : `(${innerText}:${newWeight.toFixed(2)})`;

        setValue(value.slice(0, start) + newText + value.slice(end));
        requestAnimationFrame(() => textarea.setSelectionRange(start, start + newText.length));
      }
    };
  }

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
        position: "relative",
      }}
    >
      {/* Prompt tabs + history */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 32, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, minWidth: 0 }}>
          {promptTabs.map((t, i) => (
            <PromptTab
              key={t.id} tab={t} index={i}
              active={t.id === activePromptTabId}
              canClose={promptTabs.length > 1}
              onSelect={() => onSelectTab(t.id)}
              onClose={() => onCloseTab(t.id)}
              onRename={(name) => onRenameTab(t.id, name)}
            />
          ))}
          <button onClick={onAddTab} title="New prompt tab" style={tabButtonStyle(false)}>+</button>
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            title="Prompt history"
            style={{ ...tabButtonStyle(historyOpen), display: "flex", alignItems: "center", gap: 4 }}
          >
            <Icons.History /> History
          </button>
          {historyOpen && (
            <PromptHistory
              history={promptHistory}
              onLoad={onLoadHistory} onOpenInNewTab={onOpenHistoryInNewTab}
              onToggleStar={onToggleHistoryStar} onDelete={onDeleteHistory}
              onClose={() => setHistoryOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Positive prompt */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 10, color: COLORS.accent, minWidth: 24, paddingTop: 6, fontWeight: 600 }}>+</span>
        <textarea
          value={positive}
          onChange={(e) => setPositive(e.target.value)}
          placeholder="Describe your image... (positive prompt)"
          rows={6}
          style={{
            flex: 1, background: COLORS.bgDarker, border: `1px solid ${COLORS.border}`, borderRadius: 6,
            color: "#ddd", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
            resize: "vertical", outline: "none", minHeight: 112,
          }}
          onFocus={(e) => (e.target.style.borderColor = "#a78bfa55")}
          onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          onKeyDown={makeKeyDownHandler(positive, setPositive)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
        {promptTabs.length > 1 && (
          <button
            onClick={onGenerateAll}
            disabled={!canGenerateAll}
            title={activeTool === "upscale"
              ? "Generate All isn't available for upscale"
              : `Run every tab with a prompt through the current workflow (Ctrl+Shift+Enter)`}
            style={{
              padding: "6px 12px", background: "transparent",
              border: `1px solid ${canGenerateAll ? "#a78bfa66" : COLORS.border}`, borderRadius: 6,
              color: canGenerateAll ? COLORS.accent : COLORS.textDimmer,
              cursor: canGenerateAll ? "pointer" : "not-allowed",
              fontSize: 10, fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
            }}
          >
            All ({runnableTabs})
          </button>
        )}
        </div>
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
          onKeyDown={makeKeyDownHandler(negative, setNegative)}
        />
      </div>
    </div>
  );
}

function tabButtonStyle(active) {
  return {
    background: active ? "#a78bfa22" : "transparent",
    border: `1px solid ${active ? "#a78bfa55" : COLORS.border}`, borderRadius: 4,
    color: active ? COLORS.accent : COLORS.textDim, cursor: "pointer",
    padding: "3px 8px", fontSize: 10, fontFamily: "inherit", whiteSpace: "nowrap",
  };
}

// A single prompt tab: click to select, double-click to rename, × to close
function PromptTab({ tab, index, active, canClose, onSelect, onClose, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.name);

  const commit = () => {
    const name = draft.trim();
    if (name) onRename(name);
    else setDraft(tab.name);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(tab.name); setEditing(false); }
        }}
        style={{ ...tabButtonStyle(true), width: Math.max(60, draft.length * 7), outline: "none" }}
      />
    );
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={() => { setDraft(tab.name); setEditing(true); }}
      title={`${tab.name}${index < 9 ? ` (Alt+${index + 1})` : ""} — double-click to rename`}
      style={{
        ...tabButtonStyle(active), display: "flex", alignItems: "center", gap: 6,
        opacity: !active && !tab.positive.trim() ? 0.6 : 1,
      }}
    >
      <span>{tab.name}</span>
      {canClose && (
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Close tab"
          style={{ color: COLORS.textDimmer, cursor: "pointer", lineHeight: 1 }}
        >
          ×
        </span>
      )}
    </div>
  );
}

