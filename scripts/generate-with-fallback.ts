import { existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const requiredFiles = [
  join(process.cwd(), 'public', 'data', 'library.json'),
  join(process.cwd(), 'public', 'data', 'owned.json'),
]

function hasSnapshotArtifacts(): boolean {
  return requiredFiles.every((file) => existsSync(file))
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function main() {
  const result = spawnSync(npmCommand(), ['run', 'generate'], {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })

  if (result.status === 0) {
    console.log('[generate-with-fallback] Fresh library data generated successfully.')
    return
  }

  if (!hasSnapshotArtifacts()) {
    console.error(
      '[generate-with-fallback] Generation failed and no cached snapshot artifacts are available.'
    )
    process.exit(result.status ?? 1)
  }

  console.warn(
    '[generate-with-fallback] Generation failed. Falling back to committed snapshot artifacts.'
  )
}

main()
