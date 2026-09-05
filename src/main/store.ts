import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AppSettings, ProviderId, ProviderSnapshot } from '../shared/contracts'
import { DEFAULT_SETTINGS, emptyProvider, validateSettings } from '../shared/usage'

interface PersistedState {
  version: 1
  settings: AppSettings
  providers: Partial<Record<ProviderId, ProviderSnapshot>>
}

export class StateStore {
  private readonly filePath: string

  constructor(directory: string) {
    this.filePath = path.join(directory, 'state.json')
  }

  async load(): Promise<PersistedState> {
    try {
      const value = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<PersistedState>
      if (value.version !== 1) throw new Error('Unsupported cache version')
      return {
        version: 1,
        settings: validateSettings({ ...DEFAULT_SETTINGS, ...value.settings }),
        providers: value.providers ?? {},
      }
    } catch {
      return { version: 1, settings: DEFAULT_SETTINGS, providers: {} }
    }
  }

  async save(settings: AppSettings, providers: Record<ProviderId, ProviderSnapshot>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.tmp`
    const value: PersistedState = { version: 1, settings, providers }
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.filePath)
  }

  static hydrateProviders(
    providers: Partial<Record<ProviderId, ProviderSnapshot>>,
  ): Record<ProviderId, ProviderSnapshot> {
    return {
      codex: providers.codex ?? emptyProvider('codex'),
      claude: providers.claude ?? emptyProvider('claude'),
    }
  }
}
