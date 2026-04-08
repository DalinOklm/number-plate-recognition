"use client"

import { useScannerSettings } from "@/contexts/scanner-settings"
import { cn } from "@/lib/utils"

export function SmartModeToggle() {
  const { smartMode, setSmartMode, larnaMode } = useScannerSettings()

  return (
    <div
      className={cn(
        "flex items-center rounded-full border p-0.5 text-xs font-medium transition-all duration-300",
        larnaMode
          ? "border-[#ff4da6]/30 bg-[#1a0f1f]/80"
          : "border-border/50 bg-card/80"
      )}
    >
      <button
        onClick={() => setSmartMode(false)}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 transition-all duration-200",
          !smartMode
            ? larnaMode
              ? "bg-[#ff4da6] text-white"
              : "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Fast
      </button>
      <button
        onClick={() => setSmartMode(true)}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 transition-all duration-200",
          smartMode
            ? larnaMode
              ? "bg-[#ff4da6] text-white"
              : "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Smart
      </button>
    </div>
  )
}
