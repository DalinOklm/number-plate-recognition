"use client"

import { useRef, useEffect, useCallback, useState, type RefObject } from "react"
import type { BoundingBox } from "@/hooks/use-plate-scanner"
import { useScannerSettings } from "@/contexts/scanner-settings"
import { cn } from "@/lib/utils"

interface CameraViewProps {
  onFrame: (frameData: string) => void
  boundingBox: BoundingBox | null
  isScanning: boolean
  frameInterval?: number
  videoRef?: RefObject<HTMLVideoElement | null>
  larnaMode?: boolean
}

export function CameraView({
  onFrame,
  boundingBox,
  isScanning,
  frameInterval = 500,
  videoRef: externalVideoRef,
  larnaMode = false,
}: CameraViewProps) {
  const { selectedCameraId, setAvailableCameras } = useScannerSettings()
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const videoRef = externalVideoRef ?? internalVideoRef
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastFrameTimeRef = useRef(0)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 })

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [videoRef])

  useEffect(() => {
    let cancelled = false

    async function initCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setHasCamera(false)
          setCameraError("This browser does not support camera access.")
          return
        }

        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }))
        setAvailableCameras(cameras)

        if (!window.isSecureContext) {
          setHasCamera(false)
          setCameraError(
            "Camera access requires localhost or HTTPS. Open the app on http://localhost:3000 instead of the local network HTTP URL."
          )
          return
        }

        const videoConstraints = selectedCameraId
          ? {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              facingMode: "environment" as const,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }

        stopCamera()

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            const video = videoRef.current
            if (!video) return
            setDimensions({ width: video.videoWidth, height: video.videoHeight })
            void video.play().catch(() => null)
          }
        }

        const refreshedDevices = await navigator.mediaDevices.enumerateDevices()
        const refreshedCameras = refreshedDevices
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }))
        setAvailableCameras(refreshedCameras)

        setHasCamera(true)
        setCameraError(null)
      } catch (error) {
        setHasCamera(false)
        if (error instanceof DOMException) {
          if (error.name === "NotAllowedError") {
            setCameraError("Camera permission was denied. Allow camera access in your browser and reload.")
            return
          }
          if (error.name === "NotFoundError") {
            setCameraError("No camera device was found on this machine.")
            return
          }
          if (error.name === "NotReadableError") {
            setCameraError("The camera is busy in another app. Close the other app and try again.")
            return
          }
          setCameraError(`Camera error: ${error.name}`)
          return
        }
        setCameraError("Unable to initialize the camera.")
      }
    }

    void initCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [selectedCameraId, setAvailableCameras, stopCamera, videoRef])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const frameData = canvas.toDataURL("image/jpeg", 0.8)
    onFrame(frameData)
  }, [onFrame, isScanning, videoRef])

  useEffect(() => {
    if (!isScanning) return

    const loop = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= frameInterval) {
        captureFrame()
        lastFrameTimeRef.current = timestamp
      }
      animationRef.current = requestAnimationFrame(loop)
    }

    animationRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isScanning, captureFrame, frameInterval])

  useEffect(() => {
    if (!overlayRef.current) return

    const overlay = overlayRef.current
    const ctx = overlay.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, overlay.width, overlay.height)

    if (!boundingBox) return

    const scaleX = overlay.width / dimensions.width
    const scaleY = overlay.height / dimensions.height
    const x = boundingBox.x * scaleX
    const y = boundingBox.y * scaleY
    const width = boundingBox.width * scaleX
    const height = boundingBox.height * scaleY
    const cornerLength = Math.max(8, Math.min(width, height) * 0.12)
    const neonColor = larnaMode ? "#ff4da6" : "#39ff14"

    ctx.shadowColor = neonColor
    ctx.shadowBlur = 2
    ctx.strokeStyle = neonColor
    ctx.lineWidth = 1.5

    ctx.beginPath()
    ctx.moveTo(x, y + cornerLength)
    ctx.lineTo(x, y)
    ctx.lineTo(x + cornerLength, y)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x + width - cornerLength, y)
    ctx.lineTo(x + width, y)
    ctx.lineTo(x + width, y + cornerLength)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x, y + height - cornerLength)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x + cornerLength, y + height)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x + width - cornerLength, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width, y + height - cornerLength)
    ctx.stroke()
  }, [boundingBox, dimensions, larnaMode])

  useEffect(() => {
    function handleResize() {
      if (overlayRef.current && videoRef.current) {
        const rect = videoRef.current.getBoundingClientRect()
        overlayRef.current.width = rect.width
        overlayRef.current.height = rect.height
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [videoRef])

  if (!hasCamera) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center",
          larnaMode ? "bg-[#1a0f1f]" : "bg-secondary"
        )}
      >
        <div className="max-w-xl px-6 text-center">
          <div className="mb-4 text-4xl font-semibold">Camera</div>
          <p className="text-lg text-muted-foreground">Camera access required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {cameraError ?? "Please allow camera permissions to scan license plates"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        larnaMode ? "bg-[#1a0f1f]" : "bg-background"
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {isScanning && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "animate-scan absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent to-transparent opacity-60",
              larnaMode ? "via-[#ff4da6]" : "via-primary"
            )}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "h-32 w-64 rounded-lg border-2 border-dashed transition-colors duration-300",
            larnaMode ? "border-[#ff4da6]/30" : "border-muted-foreground/30"
          )}
        />
      </div>
    </div>
  )
}
