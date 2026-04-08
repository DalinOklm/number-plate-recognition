"use client"

import { cn } from "@/lib/utils"

interface PlateResultProps {
  plate: string | null
  isVisible: boolean
  onDismiss: () => void
  openaiUsed?: boolean
  larnaMode?: boolean
}

export function PlateResult({
  plate,
  isVisible,
  onDismiss,
  openaiUsed = false,
  larnaMode = false,
}: PlateResultProps) {
  if (!isVisible || !plate) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm",
        larnaMode ? "bg-[#1a0f1f]/80" : "bg-background/80"
      )}
      onClick={onDismiss}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 p-8 shadow-2xl transition-all duration-500",
          isVisible ? "scale-100 opacity-100" : "scale-90 opacity-0",
          larnaMode
            ? "border-[#ff4da6] bg-[#1a0f1f]"
            : "border-primary bg-card"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success glow effect */}
        <div
          className={cn(
            "absolute -inset-1 animate-pulse rounded-2xl blur-xl",
            larnaMode ? "bg-[#ff4da6]/30" : "bg-primary/20"
          )}
        />

        <div className="relative">
          {/* Success icon */}
          <div className="mb-4 flex justify-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full",
                larnaMode ? "bg-[#ff4da6]/20" : "bg-primary/20"
              )}
            >
              <svg
                className={cn(
                  "h-8 w-8",
                  larnaMode ? "text-[#ff4da6]" : "text-primary"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Label */}
          <p
            className={cn(
              "mb-2 text-center text-sm font-medium uppercase tracking-wider",
              larnaMode ? "text-[#ff85c1]" : "text-muted-foreground"
            )}
          >
            {openaiUsed ? "Final License Read" : "License Plate"}
          </p>

          {openaiUsed && (
            <p
              className={cn(
                "mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em]",
                larnaMode ? "text-[#ff4da6]" : "text-primary"
              )}
            >
              Final Read Locked
            </p>
          )}

          {/* Plate display */}
          <div
            className={cn(
              "rounded-lg border-2 px-8 py-4 shadow-inner",
              larnaMode
                ? "border-[#ff4da6] bg-[#0f0a10]"
                : "border-primary bg-background"
            )}
          >
            <p
              className={cn(
                "text-center font-mono text-3xl font-bold tracking-[0.2em] md:text-4xl",
                larnaMode ? "text-[#ff4da6]" : "text-foreground"
              )}
            >
              {plate}
            </p>
          </div>

          {/* Scan again button */}
          <button
            onClick={onDismiss}
            className={cn(
              "mt-6 w-full rounded-lg px-6 py-3 font-medium transition-all duration-300",
              larnaMode
                ? "bg-[#ff4da6] text-white hover:bg-[#ff66cc] hover:shadow-[0_0_20px_rgba(255,77,166,0.4)]"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Scan Another
          </button>
        </div>
      </div>
    </div>
  )
}
