import React from "react";
import { cn } from "../../utils";

export function Spinner({ className, size = 20 }) {
  return (
    <svg className={cn("animate-spin text-brand", className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingState({ label = "Loading…", className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-ink-soft", className)} data-testid="loading-state">
      <Spinner size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse-soft rounded-xl bg-muted", className)} />;
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-14 px-6 text-center", className)} data-testid="empty-state">
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-ink-soft">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 py-12 px-6 text-center", className)} data-testid="error-state">
      <p className="text-sm font-medium text-danger">{message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary" data-testid="retry-button">
          Try again
        </button>
      )}
    </div>
  );
}
