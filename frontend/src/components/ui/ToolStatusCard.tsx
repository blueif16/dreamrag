"use client";

interface ToolStatusCardProps {
  name: string;
  args?: Record<string, unknown>;
  status: "executing" | "complete" | "error";
}

export function ToolStatusCard({ name, args, status }: ToolStatusCardProps) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "complete"
              ? "bg-green-500"
              : status === "error"
              ? "bg-red-500"
              : "bg-yellow-400 animate-pulse"
          }`}
        />
        <span className="text-muted-foreground">
          {status === "complete" ? "Called" : status === "error" ? "Failed" : "Calling"}
        </span>
        <span className="font-semibold text-foreground">{name}</span>
      </div>
      {args && Object.keys(args).length > 0 && (
        <div className="mt-1 pl-4 text-muted-foreground">
          {Object.entries(args)
            .slice(0, 3)
            .map(([k, v]) => (
              <div key={k}>
                {k}: {typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
