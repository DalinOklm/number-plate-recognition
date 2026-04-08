import { NextResponse } from "next/server"

// Mock detection simulation
// In production, this would call YOLO + OCR APIs
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body.frame) {
      return NextResponse.json(
        { error: "No frame data provided" },
        { status: 400 }
      )
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200))

    // Simulate detection with some randomness for demo
    const random = Math.random()
    
    // 70% chance of detecting something
    if (random > 0.3) {
      // Simulate YOLO detection confidence
      const yoloConfidence = 0.75 + Math.random() * 0.24 // 0.75 - 0.99
      
      // 80% chance of OCR success when YOLO detects
      const ocrSuccess = Math.random() > 0.2
      const ocrConfidence = ocrSuccess ? 0.7 + Math.random() * 0.29 : 0.3 + Math.random() * 0.3
      
      // Generate random plate for demo
      const plateChars = "ABCDEFGHJKLMNPRSTUVWXYZ"
      const plateNums = "0123456789"
      const plateText = ocrSuccess
        ? `${plateChars[Math.floor(Math.random() * plateChars.length)]}${
            plateChars[Math.floor(Math.random() * plateChars.length)]
          }${plateChars[Math.floor(Math.random() * plateChars.length)]}${
            plateNums[Math.floor(Math.random() * plateNums.length)]
          }${plateNums[Math.floor(Math.random() * plateNums.length)]}${
            plateNums[Math.floor(Math.random() * plateNums.length)]
          }${plateNums[Math.floor(Math.random() * plateNums.length)]}`
        : null

      // Simulated bounding box (center of frame)
      const boundingBox = {
        x: 180 + Math.random() * 40,
        y: 200 + Math.random() * 40,
        width: 200 + Math.random() * 50,
        height: 60 + Math.random() * 20,
      }

      return NextResponse.json({
        detected: true,
        boundingBox,
        yoloConfidence,
        ocrConfidence,
        plateText,
      })
    }

    // No detection
    return NextResponse.json({
      detected: false,
      boundingBox: null,
      yoloConfidence: 0,
      ocrConfidence: 0,
      plateText: null,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to analyze frame" },
      { status: 500 }
    )
  }
}
