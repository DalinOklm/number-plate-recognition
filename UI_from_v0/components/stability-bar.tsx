"use client"

import { useScannerSettings } from "@/contexts/scanner-settings"
import { cn } from "@/lib/utils"

interface StabilityBarProps {
  progress: number // 0-100
  isVisible: boolean
}

export function StabilityBar({ progress, isVisible }: StabilityBarProps) {
  const { stabilityIndicatorEnabled, larnaMode } = useScannerSettings()

  if (!stabilityIndicatorEnabled || !isVisible) return null

  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 translate-y-20">
      <div
        className={cn(
          "h-1.5 w-32 overflow-hidden rounded-full",
          larnaMode ? "bg-[#1a0f1f]/80" : "bg-background/80"
        )}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            progress < 33
              ? "bg-red-500"
              : progress < 66
                ? larnaMode ? "bg-[#ff85c1]" : "bg-yellow-500"
                : larnaMode ? "bg-[#ff4da6] shadow-[0_0_10px_#ff4da6]" : "bg-primary shadow-[0_0_10px_var(--primary)]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1 text-center text-xs font-medium",
          larnaMode ? "text-[#ff85c1]" : "text-muted-foreground"
        )}
      >
        {progress < 33 ? "Stabilizing..." : progress < 66 ? "Hold steady..." : "Confirming..."}
      </p>
    </div>
  )
}
