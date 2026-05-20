#!/usr/bin/env node
/* eslint-disable no-console */
// Build the embedded Chaterm submodule (third_party/ChatermForRaven) and copy
// the renderer + raven-embedded preload artifacts into resources/chaterm/ so
// they get bundled by electron-builder. See OpenSpec change
// `embed-chaterm-ssh-tab` task 8.2 / 8.3.
//
// Usage:
//   node scripts/build-chaterm.js              # default: cn edition
//   node scripts/build-chaterm.js --skip-install
//   APP_EDITION=global node scripts/build-chaterm.js
//
// Steps:
//   1. (optional) npm install inside the submodule
//   2. CHATERM_EMBEDDED=1 npm run build inside the submodule
//   3. Copy out/renderer/      -> resources/chaterm/
//   4. Copy out/preload/raven-embedded.js -> resources/chaterm/preload.js

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const SUBMODULE = path.join(REPO_ROOT, 'third_party', 'ChatermForRaven')
const OUT_RENDERER = path.join(SUBMODULE, 'out', 'renderer')
const OUT_PRELOAD = path.join(SUBMODULE, 'out', 'preload', 'raven-embedded.js')
const OUT_PRELOAD_MAP = path.join(SUBMODULE, 'out', 'preload', 'raven-embedded.js.map')
const TARGET_DIR = path.join(REPO_ROOT, 'resources', 'chaterm')

const args = process.argv.slice(2)
const forceInstall = args.includes('--install')
// Default: install only when node_modules is missing. Pass --install to force.
const skipInstall =
  args.includes('--skip-install') || (!forceInstall && fs.existsSync(path.join(SUBMODULE, 'node_modules')))
const edition = process.env.APP_EDITION || 'cn'

function step(name) {
  console.log(`\n[build-chaterm] ${name}`)
}

function run(command, cwd, env = {}) {
  // Use `npm.cmd` on Windows where `npm` resolves to a .cmd shim.
  const cmd = process.platform === 'win32' && command[0] === 'npm' ? ['npm.cmd', ...command.slice(1)] : command
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
  if (result.status !== 0) {
    console.error(`[build-chaterm] command failed (exit ${result.status}): ${cmd.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

function ensureSubmodule() {
  if (!fs.existsSync(path.join(SUBMODULE, 'package.json'))) {
    console.error(`[build-chaterm] Chaterm submodule missing at ${SUBMODULE}`)
    console.error('[build-chaterm] Run `git submodule update --init` first.')
    process.exit(1)
  }
}

function rimraf(target) {
  if (!fs.existsSync(target)) return
  fs.rmSync(target, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else if (entry.isFile()) fs.copyFileSync(s, d)
    else if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(s), d)
    }
  }
}

function main() {
  ensureSubmodule()

  if (!skipInstall) {
    step('Installing Chaterm submodule dependencies (npm install)')
    run(['npm', 'install', '--no-audit', '--no-fund'], SUBMODULE)
  } else {
    step('Skipping npm install (--skip-install)')
  }

  step(`Building Chaterm in embedded mode (edition=${edition})`)
  run(['npm', 'run', `build:${edition}`], SUBMODULE, {
    CHATERM_EMBEDDED: '1',
    APP_EDITION: edition
  })

  if (!fs.existsSync(OUT_RENDERER)) {
    console.error(`[build-chaterm] Chaterm renderer output missing: ${OUT_RENDERER}`)
    process.exit(1)
  }
  if (!fs.existsSync(OUT_PRELOAD)) {
    console.error(`[build-chaterm] Chaterm raven-embedded preload missing: ${OUT_PRELOAD}`)
    process.exit(1)
  }

  step(`Resetting target directory ${TARGET_DIR}`)
  rimraf(TARGET_DIR)
  fs.mkdirSync(TARGET_DIR, { recursive: true })

  step('Copying renderer artifacts')
  copyDir(OUT_RENDERER, TARGET_DIR)

  step('Copying raven-embedded preload -> preload.js')
  fs.copyFileSync(OUT_PRELOAD, path.join(TARGET_DIR, 'preload.js'))
  if (fs.existsSync(OUT_PRELOAD_MAP)) {
    fs.copyFileSync(OUT_PRELOAD_MAP, path.join(TARGET_DIR, 'preload.js.map'))
  }

  // index.html sanity check — Raven's ChatermProcessService.start() gates the
  // Terminal tab on its presence.
  if (!fs.existsSync(path.join(TARGET_DIR, 'index.html'))) {
    console.error('[build-chaterm] resources/chaterm/index.html missing after copy — renderer build is broken')
    process.exit(1)
  }

  step('Done')
}

main()
