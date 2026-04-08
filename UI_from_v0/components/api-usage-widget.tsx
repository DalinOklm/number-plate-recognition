"use client"

import { useScannerSettings } from "@/contexts/scanner-settings"
import { cn } from "@/lib/utils"

export function ApiUsageWidget() {
  const { apiMonitorEnabled, apiCalls, savedCalls, larnaMode } = useScannerSettings()

  if (!apiMonitorEnabled) return null

  return (
    <div
      className={cn(
        "absolute right-4 top-32 z-20 rounded-lg border px-3 py-2 text-xs font-mono backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-right-4",
        larnaMode
          ? "border-[#ff4da6]/30 bg-[#1a0f1f]/80 text-[#ff85c1]"
          : "border-border/50 bg-card/80 text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            larnaMode ? "bg-[#ff4da6]" : "bg-primary"
          )} />
          <span>API: <span className={cn(
            "font-semibold",
            larnaMode ? "text-[#ff4da6]" : "text-foreground"
          )}>{apiCalls}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Saved: <span className="font-semibold text-emerald-400">{savedCalls}</span></span>
        </div>
      </div>
    </div>
  )
}
