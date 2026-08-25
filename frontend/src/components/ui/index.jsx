import React from "react";
import { cn } from "../../utils";

export function Button({ variant = "primary", className, children, as: As = "button", ...props }) {
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    danger: "btn-danger",
  };
  return (
    <As className={cn(variants[variant] || variants.primary, className)} {...props}>
      {children}
    </As>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Input({ label, error, className, id, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <input id={id} className={cn("field", error && "border-danger focus:border-danger focus:ring-danger/20", className)} {...props} />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function Select({ label, error, className, id, children, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <select id={id} className={cn("field", className)} {...props}>
        {children}
      </select>
    </div>
  );
}

export function Textarea({ label, className, id, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <textarea id={id} className={cn("field min-h-[90px] resize-y", className)} {...props} />
    </div>
  );
}

export function Badge({ children, color = "#8A8F87", className }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {children}
    </span>
  );
}

export { Modal } from "./Modal";
