import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

export interface ProcessResult {
  exitCode: number
  stdout: string
  stderr: string
}

export async function findExecutable(name: 'codex' | 'claude'): Promise<string | null> {
  const home = os.homedir()
  const candidates = [
    path.join(home, '.volta/bin', name),
    path.join(home, '.local/bin', name),
    path.join(home, '.npm-global/bin', name),
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    ...String(process.env.PATH ?? '')
      .split(path.delimiter)
      .filter(Boolean)
      .map((directory) => path.join(directory, name)),
  ]

  for (const candidate of [...new Set(candidates)]) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next known location.
    }
  }
  return null
}

export function runProcess(
  executable: string,
  args: string[],
  options: { input?: string; timeoutMs?: number } = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(new Error(`${path.basename(executable)} timed out.`))
    }, options.timeoutMs ?? 20_000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode: code ?? -1, stdout, stderr })
    })

    child.stdin.end(options.input ?? '')
  })
}

export function runJsonLineProtocol(
  executable: string,
  args: string[],
  requestLines: string[],
  responseId: number,
  timeoutMs = 25_000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let buffer = ''
    let stderr = ''
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGTERM')
      callback()
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Codex did not return usage data in time.')))
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const message = JSON.parse(line) as { id?: number }
          if (message.id === responseId) {
            finish(() => resolve(message))
            return
          }
        } catch {
          // App-server notifications and non-JSON diagnostics are not terminal.
        }
      }
    })
    child.on('error', (error) => finish(() => reject(error)))
    child.on('close', (code) => {
      if (settled) return
      finish(() =>
        reject(
          new Error(
            stderr.trim() || `Codex app-server exited before replying (code ${code ?? -1}).`,
          ),
        ),
      )
    })

    child.stdin.write(`${requestLines.join('\n')}\n`)
  })
}
