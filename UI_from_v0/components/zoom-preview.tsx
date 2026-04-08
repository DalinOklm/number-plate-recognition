"use client"

import { useScannerSettings } from "@/contexts/scanner-settings"
import { cn } from "@/lib/utils"
import type { BoundingBox } from "@/hooks/use-plate-scanner"
import { useRef, useEffect } from "react"

interface ZoomPreviewProps {
  boundingBox: BoundingBox | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  isVisible: boolean
}

export function ZoomPreview({ boundingBox, videoRef, isVisible }: ZoomPreviewProps) {
  const { zoomAssistEnabled, larnaMode } = useScannerSettings()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!zoomAssistEnabled || !isVisible || !boundingBox || !videoRef.current || !canvasRef.current) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return

    // Calculate zoom area with padding
    const padding = 20
    const x = Math.max(0, boundingBox.x - padding)
    const y = Math.max(0, boundingBox.y - padding)
    const width = Math.min(boundingBox.width + padding * 2, video.videoWidth - x)
    const height = Math.min(boundingBox.height + padding * 2, video.videoHeight - y)

    // Draw zoomed area
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height)
  }, [boundingBox, videoRef, zoomAssistEnabled, isVisible])

  if (!zoomAssistEnabled || !isVisible || !boundingBox) return null

  return (
    <div
      className={cn(
        "absolute bottom-32 right-4 z-20 overflow-hidden rounded-lg border-2 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-right-4",
        larnaMode
          ? "border-[#ff4da6] shadow-[0_0_15px_rgba(255,77,166,0.3)]"
          : "border-primary shadow-[0_0_15px_var(--neon-glow)]"
      )}
    >
      <canvas
        ref={canvasRef}
        width={160}
        height={60}
        className="block bg-background"
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 px-2 py-0.5 text-center text-[10px] font-medium",
          larnaMode
            ? "bg-[#ff4da6]/80 text-white"
            : "bg-primary/80 text-primary-foreground"
        )}
      >
        Plate Preview
      </div>
    </div>
  )
}
