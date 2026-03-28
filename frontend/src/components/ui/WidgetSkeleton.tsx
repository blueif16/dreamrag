"use client";

interface WidgetSkeletonProps {
  label?: string;
}

export function WidgetSkeleton({ label }: WidgetSkeletonProps) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm animate-pulse">
      <div className="h-4 w-1/3 rounded bg-muted mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      {label && (
        <p className="mt-4 text-xs text-muted-foreground font-mono">{label}</p>
      )}
    </div>
  );
}
