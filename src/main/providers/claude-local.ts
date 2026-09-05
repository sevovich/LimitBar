import { access, chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ProviderSnapshot } from '../../shared/contracts'
import { makeLimitWindow, WEEKLY_MINUTES, FIVE_HOUR_MINUTES } from '../../shared/usage'

const integrationDirectory = path.join(os.homedir(), '.limitbar')
const helperPath = path.join(integrationDirectory, 'claude-statusline.cjs')
const snapshotPath = path.join(integrationDirectory, 'claude-usage.json')
const backupPath = path.join(integrationDirectory, 'claude-statusline-backup.json')
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
const helperCommand = `/usr/bin/env node ${JSON.stringify(helperPath)}`

interface StatusLineConfiguration {
  type?: string
  command?: string
  padding?: number
  refreshInterval?: number
  [key: string]: unknown
}

interface ClaudeSettings {
  statusLine?: StatusLineConfiguration
  [key: string]: unknown
}

interface LocalSnapshot {
  observedAt?: string
  fiveHour?: { usedPercentage?: number; resetsAt?: number }
  weekly?: { usedPercentage?: number; resetsAt?: number }
}

export async function configureClaudeLocalSnapshots(enabled: boolean): Promise<void> {
  await mkdir(integrationDirectory, { recursive: true, mode: 0o700 })
  await mkdir(path.dirname(settingsPath), { recursive: true })
  const settings = await readJson<ClaudeSettings>(settingsPath, {})

  if (enabled) {
    let previous = settings.statusLine ?? null
    if (await exists(backupPath)) {
      previous = (await readJson<{ previous: StatusLineConfiguration | null }>(backupPath, {
        previous: null,
      })).previous
    } else {
      await writeJsonAtomic(backupPath, { previous })
    }

    await writeFile(helperPath, helperSource(previous?.command ?? null), { mode: 0o700 })
    await chmod(helperPath, 0o700)
    settings.statusLine = {
      ...(settings.statusLine ?? {}),
      type: 'command',
      command: helperCommand,
      refreshInterval: settings.statusLine?.refreshInterval ?? 30,
    }
    await writeJsonAtomic(settingsPath, settings)
    return
  }

  if (settings.statusLine?.command !== helperCommand || !(await exists(backupPath))) return
  const backup = await readJson<{ previous: StatusLineConfiguration | null }>(backupPath, {
    previous: null,
  })
  if (backup.previous) settings.statusLine = backup.previous
  else delete settings.statusLine
  await writeJsonAtomic(settingsPath, settings)
  await unlink(backupPath).catch(() => undefined)
}

export async function probeClaudeLocal(): Promise<ProviderSnapshot> {
  try {
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as LocalSnapshot
    const windows = [
      snapshot.fiveHour?.usedPercentage == null
        ? null
        : makeLimitWindow({
            id: 'five_hour',
            durationMinutes: FIVE_HOUR_MINUTES,
            usedPercent: snapshot.fiveHour.usedPercentage,
            resetsAt: snapshot.fiveHour.resetsAt,
          }),
      snapshot.weekly?.usedPercentage == null
        ? null
        : makeLimitWindow({
            id: 'seven_day',
            durationMinutes: WEEKLY_MINUTES,
            usedPercent: snapshot.weekly.usedPercentage,
            resetsAt: snapshot.weekly.resetsAt,
          }),
    ].filter((window): window is NonNullable<typeof window> => window !== null)

    if (windows.length === 0) throw new Error('The local Claude snapshot contains no limits.')
    const observedAt = snapshot.observedAt ? new Date(snapshot.observedAt) : new Date(0)
    const stale = Date.now() - observedAt.getTime() > 15 * 60 * 1000
    return {
      provider: 'claude',
      displayName: 'Claude',
      source: 'local',
      status: stale ? 'stale' : 'ready',
      plan: null,
      windows,
      updatedAt: observedAt.toISOString(),
      error: stale ? 'Local data is older than 15 minutes. Use Claude Code to refresh it.' : null,
      retryAfter: null,
    }
  } catch (error) {
    return {
      provider: 'claude',
      displayName: 'Claude',
      source: 'local',
      status: 'unavailable',
      plan: null,
      windows: [],
      updatedAt: null,
      error:
        error instanceof SyntaxError
          ? 'The local Claude snapshot could not be read.'
          : 'No local Claude data yet. Start Claude Code and send one message.',
      retryAfter: null,
    }
  }
}

function helperSource(previousCommand: string | null): string {
  return `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const snapshotPath = ${JSON.stringify(snapshotPath)};
const previousCommand = ${JSON.stringify(previousCommand)};
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const snapshot = {
      observedAt: new Date().toISOString(),
      fiveHour: data.rate_limits?.five_hour ? {
        usedPercentage: data.rate_limits.five_hour.used_percentage,
        resetsAt: data.rate_limits.five_hour.resets_at
      } : undefined,
      weekly: data.rate_limits?.seven_day ? {
        usedPercentage: data.rate_limits.seven_day.used_percentage,
        resetsAt: data.rate_limits.seven_day.resets_at
      } : undefined
    };
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true, mode: 0o700 });
    const temporary = snapshotPath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(snapshot), { mode: 0o600 });
    fs.renameSync(temporary, snapshotPath);
  } catch {}
  if (!previousCommand) return;
  const child = spawn('/bin/zsh', ['-lc', previousCommand], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.stdin.end(input);
});
`
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.limitbar-tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, filePath)
}
