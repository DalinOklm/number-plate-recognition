"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export type ScanStatus =
  | "idle"
  | "searching"
  | "detected"
  | "analyzing"
  | "confirmed"
  | "move-closer"

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ScanResult {
  plate: string
  yoloConfidence: number
  ocrConfidence: number
  boundingBox: BoundingBox
}

export interface PlateDetection {
  detected: boolean
  boundingBox: BoundingBox | null
  yoloConfidence: number
  ocrConfidence: number
  combinedScore: number
  plateText: string | null
  status?: string
  lowConfidence?: boolean
  openaiUsed?: boolean
  openaiPlate?: string | null
  finalized?: boolean
}

export function usePlateScanner() {
  const [status, setStatus] = useState<ScanStatus>("idle")
  const [detection, setDetection] = useState<PlateDetection | null>(null)
  const [confirmedPlate, setConfirmedPlate] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const lastPlateRef = useRef<string | null>(null)
  const lastRequestedPlateRef = useRef<string | null>(null)
  const consecutiveDetectionsRef = useRef(0)

  const analyzeFrame = useCallback(async (
    frameData: string,
    options?: { forceFinalize?: boolean }
  ) => {
    if (isProcessing) return
    if (
      !options?.forceFinalize &&
      detection?.plateText &&
      detection.ocrConfidence >= 0.7 &&
      detection.plateText === lastRequestedPlateRef.current
    ) {
      return
    }

    setIsProcessing(true)
    setStatus("analyzing")

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frame: frameData,
          forceFinalize: Boolean(options?.forceFinalize),
        }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const result: PlateDetection = await response.json()

      setDetection(result)
      if (result.plateText) {
        lastRequestedPlateRef.current = result.plateText
      }

      if (result.detected && result.boundingBox) {
        if (options?.forceFinalize && result.plateText) {
          consecutiveDetectionsRef.current = 2
          lastPlateRef.current = result.plateText
          setStatus("confirmed")
          setConfirmedPlate(result.plateText)
          return
        }
        // Check if bounding box is too small (plate too far)
        if (result.boundingBox.width < 80 || result.boundingBox.height < 30) {
          setStatus("move-closer")
        } else if (result.plateText) {
          if (result.plateText === lastPlateRef.current) {
            consecutiveDetectionsRef.current++
            if (consecutiveDetectionsRef.current >= 2) {
              setStatus("confirmed")
              setConfirmedPlate(result.plateText)
            } else {
              setStatus("detected")
            }
          } else {
            consecutiveDetectionsRef.current = 1
            lastPlateRef.current = result.plateText
            setStatus("detected")
          }
        } else {
          setStatus("detected")
        }
      } else {
        consecutiveDetectionsRef.current = 0
        setStatus("searching")
      }
    } catch {
      setStatus("searching")
    } finally {
      setIsProcessing(false)
    }
  }, [detection?.ocrConfidence, detection?.plateText, isProcessing])

  const reset = useCallback(() => {
    setStatus("idle")
    setDetection(null)
    setConfirmedPlate(null)
    lastPlateRef.current = null
    lastRequestedPlateRef.current = null
    consecutiveDetectionsRef.current = 0
  }, [])

  const startScanning = useCallback(() => {
    setStatus("searching")
    setConfirmedPlate(null)
    lastPlateRef.current = null
    lastRequestedPlateRef.current = null
    consecutiveDetectionsRef.current = 0
  }, [])

  return {
    status,
    detection,
    confirmedPlate,
    isProcessing,
    analyzeFrame,
    reset,
    startScanning,
  }
}
