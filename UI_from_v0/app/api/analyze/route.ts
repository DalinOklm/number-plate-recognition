import { NextResponse } from "next/server"

import { analyzeFrameWithPython } from "@/lib/anpr-python"


export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const frame = body?.frame

    if (typeof frame !== "string" || !frame.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "No valid frame data provided" },
        { status: 400 }
      )
    }

    const frameBuffer = Buffer.from(frame.split(",", 2)[1] ?? "", "base64")
    if (!frameBuffer.length) {
      return NextResponse.json(
        { error: "Frame data could not be decoded" },
        { status: 400 }
      )
    }

    const rawResult = await analyzeFrameWithPython({
      frame,
      imageName: body?.imageName ?? "camera-frame.jpg",
      forceFinalize: Boolean(body?.forceFinalize),
    }) as {
      detected: boolean
      plate: string | null
      yolo_confidence: number
      ocr_confidence: number
      combined_score: number
      bbox: [number, number, number, number] | null
      status: string
      low_confidence: boolean
      openai_used: boolean
      openai_plate: string | null
      finalized: boolean
    }

    const boundingBox = rawResult.bbox
      ? {
          x: rawResult.bbox[0],
          y: rawResult.bbox[1],
          width: rawResult.bbox[2] - rawResult.bbox[0],
          height: rawResult.bbox[3] - rawResult.bbox[1],
        }
      : null

    const result = {
      detected: rawResult.detected,
      boundingBox,
      yoloConfidence: rawResult.yolo_confidence,
      ocrConfidence: rawResult.ocr_confidence,
      combinedScore: rawResult.combined_score,
      plateText: rawResult.plate,
      status: rawResult.status,
      lowConfidence: rawResult.low_confidence,
      openaiUsed: rawResult.openai_used,
      openaiPlate: rawResult.openai_plate,
      finalized: rawResult.finalized,
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze frame"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
