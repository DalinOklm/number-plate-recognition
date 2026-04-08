"use client"

import { useState, useEffect } from "react"
import { useScannerSettings } from "@/contexts/scanner-settings"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useIsMobile } from "@/hooks/use-mobile"

export function ControlPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [showToast, setShowToast] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const settings = useScannerSettings()

  // Show toast when Larna Mode changes
  useEffect(() => {
    if (settings.larnaMode) {
      setShowToast("Larna Mode activated")
    }
  }, [settings.larnaMode])

  // Auto-hide toast
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  const handleLarnaModeToggle = (checked: boolean) => {
    console.log("[v0] Larna mode toggle clicked, new value:", checked)
    settings.setLarnaMode(checked)
    if (!checked) {
      setShowToast("Standard mode enabled")
    }
  }

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "absolute right-4 top-20 z-30 flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-300",
          settings.larnaMode
            ? "border-[#ff4da6]/50 bg-[#ff4da6]/20 text-[#ff4da6] hover:bg-[#ff4da6]/30"
            : "border-border/50 bg-card/80 text-foreground hover:bg-card backdrop-blur-md"
        )}
        aria-label="Settings"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Panel - Side panel on desktop, bottom sheet on mobile */}
      <div
        className={cn(
          "fixed z-50 transition-all duration-300 ease-out",
          isMobile
            ? cn(
                "inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl",
                isOpen ? "translate-y-0" : "translate-y-full"
              )
            : cn(
                "bottom-4 right-4 top-20 w-80 rounded-xl",
                isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
              ),
          settings.larnaMode
            ? "border border-[#ff4da6]/30 bg-[#1a0f1f]/95"
            : "border border-border/50 bg-card/95",
          "backdrop-blur-xl"
        )}
      >
        {/* Handle for mobile */}
        {isMobile && (
          <div className="flex justify-center py-2">
            <div className={cn(
              "h-1 w-12 rounded-full",
              settings.larnaMode ? "bg-[#ff4da6]/50" : "bg-muted-foreground/30"
            )} />
          </div>
        )}

        <div className="flex h-full flex-col overflow-hidden">
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between border-b px-4 py-3",
            settings.larnaMode ? "border-[#ff4da6]/20" : "border-border/50"
          )}>
            <h2 className={cn(
              "font-semibold",
              settings.larnaMode ? "text-[#ff85c1]" : "text-foreground"
            )}>
              Controls
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* Larna Mode Toggle */}
              <button
                type="button"
                onClick={() => handleLarnaModeToggle(!settings.larnaMode)}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-colors duration-200",
                  settings.larnaMode
                    ? "border-[#ff4da6]/50 bg-[#ff4da6]/10 hover:bg-[#ff4da6]/20"
                    : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "font-medium",
                    settings.larnaMode ? "text-[#ff4da6]" : "text-foreground"
                  )}>
                    Larna Mode
                  </span>
                  <div
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors duration-200",
                      settings.larnaMode ? "bg-[#ff4da6]" : "bg-input"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform duration-200",
                        settings.larnaMode ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </div>
                </div>
              </button>

              {/* Detection Controls Section */}
              <div className="space-y-4">
                <h3 className={cn(
                  "text-sm font-medium",
                  settings.larnaMode ? "text-[#ff85c1]" : "text-muted-foreground"
                )}>
                  Detection Controls
                </h3>

                {/* YOLO Confidence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-foreground">YOLO Confidence</label>
                    <span className={cn(
                      "text-sm font-mono",
                      settings.larnaMode ? "text-[#ff4da6]" : "text-primary"
                    )}>
                      {Math.round(settings.yoloThreshold * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[settings.yoloThreshold]}
                    onValueChange={([v]) => settings.setYoloThreshold(v)}
                    min={0.1}
                    max={1}
                    step={0.05}
                    className={cn(
                      settings.larnaMode && "[&_[role=slider]]:bg-[#ff4da6] [&_.bg-primary]:bg-[#ff4da6]"
                    )}
                  />
                </div>

                {/* OCR Confidence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-foreground">OCR Confidence</label>
                    <span className={cn(
                      "text-sm font-mono",
                      settings.larnaMode ? "text-[#ff4da6]" : "text-primary"
                    )}>
                      {Math.round(settings.ocrThreshold * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[settings.ocrThreshold]}
                    onValueChange={([v]) => settings.setOcrThreshold(v)}
                    min={0.1}
                    max={1}
                    step={0.05}
                    className={cn(
                      settings.larnaMode && "[&_[role=slider]]:bg-[#ff4da6] [&_.bg-primary]:bg-[#ff4da6]"
                    )}
                  />
                </div>

                {/* Frame Interval */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-foreground">Frame Interval</label>
                    <span className={cn(
                      "text-sm font-mono",
                      settings.larnaMode ? "text-[#ff4da6]" : "text-primary"
                    )}>
                      {settings.frameInterval}ms
                    </span>
                  </div>
                  <Slider
                    value={[settings.frameInterval]}
                    onValueChange={([v]) => settings.setFrameInterval(v)}
                    min={100}
                    max={2000}
                    step={100}
                    className={cn(
                      settings.larnaMode && "[&_[role=slider]]:bg-[#ff4da6] [&_.bg-primary]:bg-[#ff4da6]"
                    )}
                  />
                </div>
              </div>

              {/* Camera Section */}
              <div className="space-y-4">
                <h3 className={cn(
                  "text-sm font-medium",
                  settings.larnaMode ? "text-[#ff85c1]" : "text-muted-foreground"
                )}>
                  Camera
                </h3>

                <div className="space-y-2">
                  <label className="text-sm text-foreground">Active Camera</label>
                  <select
                    value={settings.selectedCameraId}
                    onChange={(event) => settings.setSelectedCameraId(event.target.value)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                      settings.larnaMode
                        ? "border-[#ff4da6]/30 bg-[#1a0f1f] text-[#ff85c1]"
                        : "border-border/50 bg-background text-foreground"
                    )}
                  >
                    <option value="">
                      Default camera
                    </option>
                    {settings.availableCameras.map((camera, index) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Select your plugged-in USB camera here if it does not open by default.
                  </p>
                </div>
              </div>

              {/* Feature Toggles Section */}
              <div className="space-y-4">
                <h3 className={cn(
                  "text-sm font-medium",
                  settings.larnaMode ? "text-[#ff85c1]" : "text-muted-foreground"
                )}>
                  Features
                </h3>

                {/* Stability Indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Scan Stability Indicator</span>
                  <Switch
                    checked={settings.stabilityIndicatorEnabled}
                    onCheckedChange={settings.setStabilityIndicatorEnabled}
                    className={cn(
                      settings.larnaMode && "data-[state=checked]:bg-[#ff4da6]"
                    )}
                  />
                </div>

                {/* Zoom Assist */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Zoom Assist</span>
                  <Switch
                    checked={settings.zoomAssistEnabled}
                    onCheckedChange={settings.setZoomAssistEnabled}
                    className={cn(
                      settings.larnaMode && "data-[state=checked]:bg-[#ff4da6]"
                    )}
                  />
                </div>

                {/* API Monitor */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">API Usage Monitor</span>
                  <Switch
                    checked={settings.apiMonitorEnabled}
                    onCheckedChange={settings.setApiMonitorEnabled}
                    className={cn(
                      settings.larnaMode && "data-[state=checked]:bg-[#ff4da6]"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div
          className={cn(
            "fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
            settings.larnaMode
              ? "bg-[#ff4da6] text-white"
              : "bg-primary text-primary-foreground"
          )}
        >
          {showToast}
        </div>
      )}
    </>
  )
}
