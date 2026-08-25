import React from "react";
import { MapPin } from "@phosphor-icons/react";

// Deterministic earthy gradient from a string — reliable, intentional, never a broken image.
const PALETTES = [
  ["#2C5530", "#5A8C63"],
  ["#4A6E82", "#7BA3B8"],
  ["#D47A57", "#E0A98E"],
  ["#D19C4C", "#E3C489"],
  ["#3E5C50", "#6E927F"],
  ["#8B5CF6", "#B79BF0"],
  ["#0EA5A0", "#5FCFC9"],
];

function hash(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export default function DestinationBanner({ name = "", className, height = "100%", label = true, children }) {
  const [a, b] = PALETTES[hash(name) % PALETTES.length];
  return (
    <div
      className={className}
      style={{
        height,
        background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        position: "relative",
        overflow: "hidden",
      }}
      aria-label={name}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.14,
          backgroundImage:
            "radial-gradient(circle at 20% 30%, #fff 0, transparent 42%), radial-gradient(circle at 80% 70%, #fff 0, transparent 38%)",
        }}
      />
      {label && name && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white/95">
          <MapPin size={16} weight="fill" />
          <span className="font-display text-sm font-bold drop-shadow">{name}</span>
        </div>
      )}
      {children}
    </div>
  );
}
