import { readFile } from 'node:fs/promises'
import path from 'node:path'

const entryPath = path.resolve('dist/renderer/index.html')
const html = await readFile(entryPath, 'utf8')
const rootRelativeAssets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]

if (rootRelativeAssets.length > 0) {
  const paths = rootRelativeAssets.map((match) => match[1]).join(', ')
  throw new Error(`Renderer contains root-relative assets that break under file://: ${paths}`)
}

const relativeAssets = [...html.matchAll(/(?:src|href)=["'](\.\/assets\/[^"']+)["']/g)]
if (relativeAssets.length < 2) {
  throw new Error('Renderer entry does not contain relative JavaScript and CSS assets.')
}

console.log(`Verified ${relativeAssets.length} relative renderer assets.`)
