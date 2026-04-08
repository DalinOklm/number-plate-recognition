"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface CameraOption {
  deviceId: string
  label: string
}

interface ScannerSettings {
  // Detection controls
  yoloThreshold: number
  ocrThreshold: number
  frameInterval: number
  
  // Feature toggles
  smartMode: boolean // true = smart (accurate), false = fast
  stabilityIndicatorEnabled: boolean
  zoomAssistEnabled: boolean
  apiMonitorEnabled: boolean
  
  // Theme
  larnaMode: boolean

  // Camera
  selectedCameraId: string
  availableCameras: CameraOption[]
  
  // API stats
  apiCalls: number
  savedCalls: number
}

interface ScannerSettingsContextType extends ScannerSettings {
  setYoloThreshold: (value: number) => void
  setOcrThreshold: (value: number) => void
  setFrameInterval: (value: number) => void
  setSmartMode: (value: boolean) => void
  setStabilityIndicatorEnabled: (value: boolean) => void
  setZoomAssistEnabled: (value: boolean) => void
  setApiMonitorEnabled: (value: boolean) => void
  setLarnaMode: (value: boolean) => void
  setSelectedCameraId: (value: string) => void
  setAvailableCameras: (value: CameraOption[]) => void
  incrementApiCalls: () => void
  incrementSavedCalls: () => void
}

const defaultSettings: ScannerSettings = {
  yoloThreshold: 0.5,
  ocrThreshold: 0.6,
  frameInterval: 500,
  smartMode: false,
  stabilityIndicatorEnabled: false,
  zoomAssistEnabled: false,
  apiMonitorEnabled: false,
  larnaMode: false,
  selectedCameraId: "",
  availableCameras: [],
  apiCalls: 0,
  savedCalls: 0,
}

const ScannerSettingsContext = createContext<ScannerSettingsContextType | null>(null)

export function ScannerSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ScannerSettings>(defaultSettings)

  const setYoloThreshold = useCallback((value: number) => {
    setSettings(prev => ({ ...prev, yoloThreshold: value }))
  }, [])

  const setOcrThreshold = useCallback((value: number) => {
    setSettings(prev => ({ ...prev, ocrThreshold: value }))
  }, [])

  const setFrameInterval = useCallback((value: number) => {
    setSettings(prev => ({ ...prev, frameInterval: value }))
  }, [])

  const setSmartMode = useCallback((value: boolean) => {
    setSettings(prev => ({ ...prev, smartMode: value }))
  }, [])

  const setStabilityIndicatorEnabled = useCallback((value: boolean) => {
    setSettings(prev => ({ ...prev, stabilityIndicatorEnabled: value }))
  }, [])

  const setZoomAssistEnabled = useCallback((value: boolean) => {
    setSettings(prev => ({ ...prev, zoomAssistEnabled: value }))
  }, [])

  const setApiMonitorEnabled = useCallback((value: boolean) => {
    setSettings(prev => ({ ...prev, apiMonitorEnabled: value }))
  }, [])

  const setLarnaMode = useCallback((value: boolean) => {
    setSettings(prev => ({ ...prev, larnaMode: value }))
  }, [])

  const setSelectedCameraId = useCallback((value: string) => {
    setSettings(prev => ({ ...prev, selectedCameraId: value }))
  }, [])

  const setAvailableCameras = useCallback((value: CameraOption[]) => {
    setSettings(prev => ({ ...prev, availableCameras: value }))
  }, [])

  const incrementApiCalls = useCallback(() => {
    setSettings(prev => ({ ...prev, apiCalls: prev.apiCalls + 1 }))
  }, [])

  const incrementSavedCalls = useCallback(() => {
    setSettings(prev => ({ ...prev, savedCalls: prev.savedCalls + 1 }))
  }, [])

  return (
    <ScannerSettingsContext.Provider
      value={{
        ...settings,
        setYoloThreshold,
        setOcrThreshold,
        setFrameInterval,
        setSmartMode,
        setStabilityIndicatorEnabled,
        setZoomAssistEnabled,
        setApiMonitorEnabled,
        setLarnaMode,
        setSelectedCameraId,
        setAvailableCameras,
        incrementApiCalls,
        incrementSavedCalls,
      }}
    >
      {children}
    </ScannerSettingsContext.Provider>
  )
}

export function useScannerSettings() {
  const context = useContext(ScannerSettingsContext)
  if (!context) {
    throw new Error("useScannerSettings must be used within ScannerSettingsProvider")
  }
  return context
}
