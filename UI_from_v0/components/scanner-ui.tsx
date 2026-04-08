"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { usePlateScanner } from "@/hooks/use-plate-scanner"
import { useScannerSettings } from "@/contexts/scanner-settings"
import { CameraView } from "@/components/camera-view"
import { MetricsOverlay } from "@/components/metrics-overlay"
import { StatusMessage } from "@/components/status-message"
import { PlateResult } from "@/components/plate-result"
import { ControlPanel } from "@/components/control-panel"
import { SmartModeToggle } from "@/components/smart-mode-toggle"
import { StabilityBar } from "@/components/stability-bar"
import { ZoomPreview } from "@/components/zoom-preview"
import { ApiUsageWidget } from "@/components/api-usage-widget"
import { cn } from "@/lib/utils"

export function ScannerUI() {
  const {
    status,
    detection,
    confirmedPlate,
    isProcessing,
    analyzeFrame,
    reset,
    startScanning,
  } = usePlateScanner()

  const settings = useScannerSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const latestFrameRef = useRef<string | null>(null)
  const [stabilityProgress, setStabilityProgress] = useState(0)

  const isScanning = status !== "idle" && status !== "confirmed"
  const showMetrics = detection?.detected && status !== "idle"

  // Track stability progress based on consecutive detections
  useEffect(() => {
    if (status === "detected") {
      setStabilityProgress((prev) => Math.min(prev + 50, 100))
    } else if (status === "confirmed") {
      setStabilityProgress(100)
    } else if (status === "searching" || status === "idle") {
      setStabilityProgress(0)
    }
  }, [status])

  const handleFrame = useCallback(
    (frameData: string) => {
      latestFrameRef.current = frameData
      // Don't send frames if we already confirmed a plate or are processing
      if (
        status === "confirmed" ||
        isProcessing ||
        (detection?.plateText &&
          detection.ocrConfidence >= 0.7 &&
          detection.plateText === confirmedPlate)
      ) {
        settings.incrementSavedCalls()
        return
      }
      settings.incrementApiCalls()
      analyzeFrame(frameData)
    },
    [status, isProcessing, detection?.plateText, detection?.ocrConfidence, confirmedPlate, analyzeFrame, settings]
  )

  const handleStart = () => {
    startScanning()
  }

  const handleReset = () => {
    reset()
    setStabilityProgress(0)
  }

  const handleRestart = () => {
    reset()
    setStabilityProgress(0)
    startScanning()
  }

  const handlePlateLock = () => {
    if (!latestFrameRef.current || isProcessing) {
      return
    }
    void analyzeFrame(latestFrameRef.current, { forceFinalize: true })
  }

  return (
    <div
      className={cn(
        "relative flex h-screen w-full flex-col transition-colors duration-300",
        settings.larnaMode ? "bg-[#1a0f1f]" : "bg-background"
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md transition-colors duration-300",
          settings.larnaMode
            ? "border-[#ff4da6]/20 bg-[#1a0f1f]/50"
            : "border-border/30 bg-card/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300",
              settings.larnaMode ? "bg-[#ff4da6]/20" : "bg-primary/20"
            )}
          >
            <svg
              className={cn(
                "h-5 w-5 transition-colors duration-300",
                settings.larnaMode ? "text-[#ff4da6]" : "text-primary"
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h1
              className={cn(
                "font-semibold transition-colors duration-300",
                settings.larnaMode ? "text-[#ff85c1]" : "text-foreground"
              )}
            >
              ANPR Scanner
            </h1>
            <p className="text-xs text-muted-foreground">
              Real-time License Plate Detection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Smart Mode Toggle */}
          <SmartModeToggle />

          {/* Live Indicator */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-300",
              isScanning
                ? settings.larnaMode
                  ? "bg-[#ff4da6]/20 text-[#ff4da6]"
                  : "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-colors duration-300",
                isScanning
                  ? settings.larnaMode
                    ? "animate-pulse bg-[#ff4da6]"
                    : "animate-pulse bg-primary"
                  : "bg-muted-foreground"
              )}
            />
            {isScanning ? "LIVE" : "STANDBY"}
          </div>
        </div>
      </header>

      {/* Control Panel */}
      <ControlPanel />

      {/* API Usage Widget */}
      <ApiUsageWidget />

      {/* Camera View */}
      <div className="flex-1 pt-16">
        <CameraView
          onFrame={handleFrame}
          boundingBox={detection?.boundingBox ?? null}
          isScanning={isScanning}
          frameInterval={settings.frameInterval}
          videoRef={videoRef}
          larnaMode={settings.larnaMode}
        />
      </div>

      {/* Stability Bar */}
      <StabilityBar
        progress={stabilityProgress}
        isVisible={status === "detected" || status === "analyzing"}
      />

      {/* Zoom Preview */}
      <ZoomPreview
        boundingBox={detection?.boundingBox ?? null}
        videoRef={videoRef}
        isVisible={detection?.detected ?? false}
      />

      {/* Metrics Overlay */}
      <MetricsOverlay
        yoloConfidence={detection?.yoloConfidence ?? 0}
        ocrConfidence={detection?.ocrConfidence ?? 0}
        combinedScore={detection?.combinedScore ?? 0}
        isVisible={showMetrics ?? false}
        larnaMode={settings.larnaMode}
      />

      {/* Status Message */}
      <StatusMessage
        status={status}
        yoloConfidence={detection?.yoloConfidence ?? 0}
        ocrConfidence={detection?.ocrConfidence ?? 0}
        larnaMode={settings.larnaMode}
      />

      {detection?.plateText && status !== "confirmed" && (
        <div className="absolute bottom-40 left-1/2 z-20 -translate-x-1/2">
          <div
            className={cn(
              "rounded-2xl border px-5 py-3 font-mono text-sm backdrop-blur-md transition-all duration-300",
              settings.larnaMode
                ? "border-[#ff4da6]/30 bg-[#1a0f1f]/85 text-[#ff85c1]"
                : "border-border/60 bg-card/85 text-foreground"
            )}
          >
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {detection.openaiUsed ? "Final Read" : "Live Plate"}
              </div>
              <div className="mt-1 text-xl font-bold tracking-[0.2em]">
                {detection.plateText}
              </div>
              {detection.openaiUsed && (
                <div
                  className={cn(
                    "mt-2 text-[11px] font-semibold uppercase tracking-[0.22em]",
                    settings.larnaMode ? "text-[#ff4da6]" : "text-primary"
                  )}
                >
                  Final Read Locked
                </div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {detection.status === "good" && "Status: good"}
                {detection.status === "moderate" && "Status: moderate"}
                {detection.status === "low" && "Status: low"}
              </div>
            </div>
          </div>
        </div>
      )}

      {detection?.plateText && (
        <div className="absolute bottom-24 right-4 z-20">
          <div className="flex flex-col gap-2">
            {!detection.finalized && (
              <button
                onClick={handlePlateLock}
                disabled={isProcessing}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-md transition-all duration-300",
                  isProcessing && "cursor-not-allowed opacity-60",
                  settings.larnaMode
                    ? "border-[#ff4da6]/50 bg-[#ff4da6]/18 text-[#ff85c1] hover:bg-[#ff4da6]/28"
                    : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                )}
              >
                PlateLock
              </button>
            )}
            <button
              onClick={handleRestart}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md transition-all duration-300",
                settings.larnaMode
                  ? "border-[#ff4da6]/40 bg-[#1a0f1f]/85 text-[#ff85c1] hover:bg-[#ff4da6]/20"
                  : "border-border/60 bg-card/85 text-foreground hover:bg-card"
              )}
            >
              Restart Scan
            </button>
          </div>
        </div>
      )}

      {/* Start/Stop Button */}
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
        <button
          onClick={isScanning ? handleReset : handleStart}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border-4 transition-all duration-300",
            isScanning
              ? "border-destructive bg-destructive/20 hover:bg-destructive/30"
              : settings.larnaMode
                ? "border-[#ff4da6] bg-[#ff4da6]/20 hover:bg-[#ff4da6]/30 shadow-[0_0_20px_rgba(255,77,166,0.3)]"
                : "border-primary bg-primary/20 hover:bg-primary/30"
          )}
        >
          {isScanning ? (
            <div className="h-5 w-5 rounded-sm bg-destructive" />
          ) : (
            <svg
              className={cn(
                "h-6 w-6 transition-colors duration-300",
                settings.larnaMode ? "text-[#ff4da6]" : "text-primary"
              )}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Plate Result Modal */}
      <PlateResult
        plate={confirmedPlate}
        isVisible={status === "confirmed"}
        onDismiss={handleReset}
        openaiUsed={detection?.openaiUsed ?? false}
        larnaMode={settings.larnaMode}
      />
    </div>
  )
}
