import React from "react";
import logo from "../assets/logo.png";
import { cn } from "../utils";

export function Logo({ size = 32, withText = true, className, textClassName }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src={logo} alt="COCO" width={size} height={size} className="rounded-lg object-contain" style={{ width: size, height: size }} />
      {withText && (
        <span className={cn("font-display text-xl font-extrabold tracking-tight text-ink", textClassName)}>
          COCO
        </span>
      )}
    </span>
  );
}

export function CocoAvatar({ size = 40, className }) {
  return (
    <span
      className={cn("inline-grid place-items-center rounded-full text-white shadow-card", className)}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 30% 30%, #6E93A6, #4A6E82 70%)",
      }}
      aria-hidden
    >
      <span style={{ fontSize: size * 0.42 }} className="font-display font-extrabold">
        C
      </span>
    </span>
  );
}
