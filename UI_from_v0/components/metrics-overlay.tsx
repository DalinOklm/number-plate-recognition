"use client"

import { cn } from "@/lib/utils"

interface MetricsOverlayProps {
  yoloConfidence: number
  ocrConfidence: number
  combinedScore?: number
  isVisible: boolean
  larnaMode?: boolean
}

export function MetricsOverlay({
  yoloConfidence,
  ocrConfidence,
  combinedScore = 0,
  isVisible,
  larnaMode = false,
}: MetricsOverlayProps) {
  if (!isVisible) return null

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return larnaMode ? "text-[#ff4da6]" : "text-primary"
    if (confidence >= 0.5) return larnaMode ? "text-[#ff85c1]" : "text-yellow-400"
    return "text-destructive"
  }

  const getBarColor = (confidence: number) => {
    if (confidence >= 0.8) return larnaMode ? "bg-[#ff4da6]" : "bg-primary"
    if (confidence >= 0.5) return larnaMode ? "bg-[#ff85c1]" : "bg-yellow-400"
    return "bg-destructive"
  }

  return (
    <div
      className={cn(
        "absolute left-4 top-20 rounded-lg border px-4 py-3 font-mono text-sm backdrop-blur-md transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        larnaMode
          ? "border-[#ff4da6]/30 bg-[#1a0f1f]/80"
          : "border-border/50 bg-card/80"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">Detect:</span>
          <span className={cn("font-semibold", getConfidenceColor(yoloConfidence))}>
            {yoloConfidence.toFixed(2)}
          </span>
          <div className={cn(
            "h-1.5 w-16 overflow-hidden rounded-full",
            larnaMode ? "bg-[#1a0f1f]" : "bg-secondary"
          )}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                getBarColor(yoloConfidence)
              )}
              style={{ width: `${yoloConfidence * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">Read:</span>
          <span className={cn("ml-1 font-semibold", getConfidenceColor(ocrConfidence))}>
            {ocrConfidence.toFixed(2)}
          </span>
          <div className={cn(
            "h-1.5 w-16 overflow-hidden rounded-full",
            larnaMode ? "bg-[#1a0f1f]" : "bg-secondary"
          )}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                getBarColor(ocrConfidence)
              )}
              style={{ width: `${ocrConfidence * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">Score:</span>
          <span className={cn("font-semibold", getConfidenceColor(combinedScore))}>
            {combinedScore.toFixed(2)}
          </span>
          <div className={cn(
            "h-1.5 w-16 overflow-hidden rounded-full",
            larnaMode ? "bg-[#1a0f1f]" : "bg-secondary"
          )}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                getBarColor(combinedScore)
              )}
              style={{ width: `${combinedScore * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
