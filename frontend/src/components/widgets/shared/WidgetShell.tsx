"use client";

import { ReactNode } from "react";

interface WidgetShellProps {
  children: ReactNode;
  label?: string;
  focused?: boolean;
}

export function WidgetShell({ children, label, focused }: WidgetShellProps) {
  return (
    <div
      className={`relative rounded-xl border bg-card shadow-sm overflow-hidden transition-all ${
        focused ? "ring-2 ring-primary" : ""
      }`}
    >
      {label && (
        <div className="absolute top-2 right-3 text-xs text-muted-foreground font-mono opacity-50">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
