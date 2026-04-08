"use client"

import { cn } from "@/lib/utils"
import type { ScanStatus } from "@/hooks/use-plate-scanner"

interface StatusMessageProps {
  status: ScanStatus
  yoloConfidence?: number
  ocrConfidence?: number
  larnaMode?: boolean
}

const statusConfig: Record<ScanStatus, { text: string; pulse: boolean }> = {
  idle: { text: "Press Start to begin scanning", pulse: false },
  searching: { text: "Searching for plate...", pulse: true },
  detected: { text: "Plate detected", pulse: true },
  analyzing: { text: "Analyzing...", pulse: true },
  confirmed: { text: "Plate confirmed", pulse: false },
  "move-closer": { text: "Move closer", pulse: true },
}

function getConfidenceColor(confidence: number, larnaMode: boolean): string {
  if (confidence < 0.4) return "text-red-500"
  if (confidence < 0.7) return larnaMode ? "text-[#ff85c1]" : "text-yellow-500"
  return larnaMode ? "text-[#ff4da6]" : "text-primary"
}

function getConfidenceLevel(confidence: number): "poor" | "moderate" | "good" {
  if (confidence < 0.4) return "poor"
  if (confidence < 0.7) return "moderate"
  return "good"
}

export function StatusMessage({
  status,
  yoloConfidence = 0,
  ocrConfidence = 0,
  larnaMode = false,
}: StatusMessageProps) {
  const config = statusConfig[status]
  const avgConfidence = (yoloConfidence + ocrConfidence) / 2
  const confidenceLevel = getConfidenceLevel(avgConfidence)
  const showConfidenceFeedback = status === "detected" || status === "analyzing"

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
      <div
        className={cn(
          "flex flex-col items-center gap-1 rounded-2xl border px-6 py-3 backdrop-blur-md transition-all duration-300",
          status === "confirmed"
            ? larnaMode
              ? "border-[#ff4da6] bg-[#ff4da6]/20"
              : "border-primary bg-primary/20"
            : larnaMode
              ? "border-[#ff4da6]/30 bg-[#1a0f1f]/80"
              : "border-border/50 bg-card/80"
        )}
      >
        <div className="flex items-center gap-2">
          {config.pulse && (
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  larnaMode ? "bg-[#ff4da6]" : "bg-primary"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  larnaMode ? "bg-[#ff4da6]" : "bg-primary"
                )}
              />
            </span>
          )}
          <span
            className={cn(
              "font-medium transition-colors duration-300",
              status === "confirmed"
                ? larnaMode
                  ? "text-[#ff4da6]"
                  : "text-primary"
                : "text-foreground"
            )}
          >
            {config.text}
          </span>
        </div>

        {/* Confidence feedback */}
        {showConfidenceFeedback && (
          <div
            className={cn(
              "text-xs font-medium transition-colors duration-300",
              getConfidenceColor(avgConfidence, larnaMode)
            )}
          >
            {confidenceLevel === "poor" && "Poor detection - adjust position"}
            {confidenceLevel === "moderate" && "Moderate - hold steady"}
            {confidenceLevel === "good" &&
              (larnaMode ? "Excellent detection!" : "Good detection!")}
          </div>
        )}
      </div>
    </div>
  )
}
