import { randomUUID } from "crypto"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import path from "path"

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

type PythonResponse = {
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

let pythonProcess: ChildProcessWithoutNullStreams | null = null
const pendingRequests = new Map<string, PendingRequest>()
let stdoutBuffer = ""

function getRepoRoot(): string {
  return path.resolve(process.cwd(), "..")
}

function getPythonExecutable(): string {
  const repoRoot = getRepoRoot()
  return process.env.ANPR_PYTHON_EXECUTABLE ?? path.join(repoRoot, "venv310", "Scripts", "python.exe")
}

function ensurePythonProcess(): ChildProcessWithoutNullStreams {
  if (pythonProcess && !pythonProcess.killed) {
    return pythonProcess
  }

  const repoRoot = getRepoRoot()
  const pythonExecutable = getPythonExecutable()
  const scriptPath = path.join(repoRoot, "src", "api.py")

  pythonProcess = spawn(pythonExecutable, ["-u", scriptPath], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  })

  pythonProcess.stdout.setEncoding("utf8")
  pythonProcess.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk
    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.trim()) continue
      let message: PythonResponse
      try {
        message = JSON.parse(line) as PythonResponse
      } catch {
        continue
      }

      const pending = pendingRequests.get(message.id)
      if (!pending) continue
      pendingRequests.delete(message.id)

      if (message.ok) {
        pending.resolve(message.result)
      } else {
        pending.reject(new Error(message.error ?? "Python ANPR request failed"))
      }
    }
  })

  pythonProcess.stderr.setEncoding("utf8")
  pythonProcess.stderr.on("data", (chunk: string) => {
    console.error("[anpr-python]", chunk.trim())
  })

  pythonProcess.on("exit", () => {
    pythonProcess = null
    for (const [id, pending] of pendingRequests.entries()) {
      pending.reject(new Error("Python ANPR service exited unexpectedly"))
      pendingRequests.delete(id)
    }
  })

  return pythonProcess
}

export async function analyzeFrameWithPython(payload: {
  frame: string
  imageName?: string
  forceFinalize?: boolean
}): Promise<unknown> {
  const child = ensurePythonProcess()
  const id = randomUUID()

  return await new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    child.stdin.write(
      JSON.stringify({
        id,
        frame: payload.frame,
        imageName: payload.imageName ?? "camera-frame.jpg",
        forceFinalize: payload.forceFinalize ?? false,
      }) + "\n"
    )
  })
}
