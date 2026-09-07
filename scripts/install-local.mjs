import { cp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const source = path.resolve('release/mac-arm64/LimitBar.app')
const applications = path.join(os.homedir(), 'Applications')
const destination = path.join(applications, 'LimitBar.app')

await mkdir(applications, { recursive: true })
await rm(destination, { recursive: true, force: true })
await cp(source, destination, { recursive: true, dereference: true })

console.log(`Installed LimitBar to ${destination}`)
