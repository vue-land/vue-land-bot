import { readFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../core/utils'

if (!import.meta.url.endsWith('/dist/index.mjs')) {
  logger.error(`Assertion failure: ${import.meta.url} is not the expected file`)
}

const rootPath = resolve(dirname(fileURLToPath(import.meta.url)), './assets')
const validRe = /^\w[-\w\/]*\.md$/

export async function getAsset(assetPath: string) {
  if (!validRe.test(assetPath)) {
    throw new Error(`Invalid asset path: ${assetPath}`)
  }

  return readFile(join(rootPath, assetPath), { encoding: 'utf8' })
}
