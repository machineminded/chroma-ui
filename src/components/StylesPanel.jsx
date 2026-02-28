import { useState } from "react";
import stylesData from "../data/styles.json";
import { COLORS, labelStyle, sectionHeaderStyle, dividerStyle } from "../styles";

// Normalize all categories into a flat list of { category, subcategory, styles[] }
function buildGroups() {
  const groups = [];
  const { styles } = stylesData;

  for (const [catKey, catVal] of Object.entries(styles)) {
    const catLabel = catKey.replace(/_/g, " ");

    if (Array.isArray(catVal)) {
      // Flat category (e.g. fine_art, cinema, game)
      groups.push({ category: catLabel, subcategory: null, styles: catVal });
    } else {
      // Nested subcategories (e.g. photography, cartoon, illustration)
      for (const [subKey, subStyles] of Object.entries(catVal)) {
        const subLabel = subKey.replace(/_/g, " ");
        groups.push({ category: catLabel, subcategory: subLabel, styles: subStyles });
      }
    }
  }

  return groups;
}

const GROUPS = buildGroups();

// Which top-level categories have subcategories
const TOP_CATEGORIES = [...new Set(GROUPS.map((g) => g.category))];

export default function StylesPanel({ selectedStyle, setSelectedStyle }) {
  const [openCats, setOpenCats] = useState(
    Object.fromEntries(TOP_CATEGORIES.map((c) => [c, true]))
  );

  const toggleCat = (cat) =>
    setOpenCats((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const selectedKey = selectedStyle ? selectedStyle.name : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Clear selection */}
      <div
        onClick={() => setSelectedStyle(null)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 4px", marginBottom: 8, cursor: "pointer", borderRadius: 4,
          background: !selectedStyle ? "#a78bfa18" : "transparent",
          border: `1px solid ${!selectedStyle ? "#a78bfa44" : "transparent"}`,
        }}
      >
        <span style={{
          width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${!selectedStyle ? COLORS.accent : COLORS.textDimmer}`,
          background: !selectedStyle ? COLORS.accent : "transparent",
          display: "inline-block",
        }} />
        <span style={{ fontSize: 11, color: !selectedStyle ? COLORS.accent : COLORS.textDim }}>
          None
        </span>
      </div>

      {TOP_CATEGORIES.map((cat) => {
        const catGroups = GROUPS.filter((g) => g.category === cat);
        const isOpen = openCats[cat];

        return (
          <div key={cat} style={{ marginBottom: 4 }}>
            {/* Category header */}
            <button
              onClick={() => toggleCat(cat)}
              style={{
                width: "100%", background: "transparent", border: "none",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", padding: "5px 2px", marginBottom: 2,
              }}
            >
              <span style={{ ...sectionHeaderStyle, fontSize: 9 }}>{cat}</span>
              <span style={{ color: COLORS.textDimmer, fontSize: 10, fontFamily: "inherit" }}>
                {isOpen ? "▾" : "▸"}
              </span>
            </button>

            {isOpen && catGroups.map((group) => (
              <div key={group.subcategory ?? group.category} style={{ marginBottom: 6 }}>
                {/* Subcategory label (only when there are subcategories) */}
                {group.subcategory && (
                  <div style={{ ...labelStyle, marginBottom: 4, marginLeft: 2 }}>
                    {group.subcategory}
                  </div>
                )}

                {group.styles.map((style) => {
                  const isSelected = selectedKey === style.name;
                  return (
                    <div
                      key={style.name}
                      onClick={() => setSelectedStyle(isSelected ? null : style)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 8,
                        padding: "5px 6px", marginBottom: 2, cursor: "pointer",
                        borderRadius: 4,
                        background: isSelected ? "#a78bfa18" : "transparent",
                        border: `1px solid ${isSelected ? "#a78bfa44" : "transparent"}`,
                        transition: "background 0.1s",
                      }}
                    >
                      {/* Radio indicator */}
                      <span style={{
                        width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
                        marginTop: 1,
                        border: `2px solid ${isSelected ? COLORS.accent : COLORS.textDimmer}`,
                        background: isSelected ? COLORS.accent : "transparent",
                        display: "inline-block",
                        transition: "all 0.1s",
                      }} />
                      <span style={{
                        fontSize: 11,
                        color: isSelected ? COLORS.accent : COLORS.text,
                        lineHeight: 1.3,
                      }}>
                        {style.name}
                      </span>
                    </div>
                  );
                })}

                <div style={{ ...dividerStyle, marginTop: 4, marginBottom: 4 }} />
              </div>
            ))}
          </div>
        );
      })}

      {/* Selected style prompt preview */}
      {selectedStyle && (
        <div style={{
          marginTop: 4,
          background: COLORS.bgDarker,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 6, padding: "8px 10px",
        }}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Style prompt appended</div>
          <div style={{ fontSize: 10, color: COLORS.textDim, lineHeight: 1.5, wordBreak: "break-word" }}>
            {selectedStyle.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
