#!/usr/bin/env node
/* eslint-disable no-console */
// Verify Raven and Chaterm submodule pin the same Electron major.minor.patch
// before packaging. See OpenSpec change `embed-chaterm-ssh-tab` task 8.5.
//
// Exits non-zero with code 1 and prints E_ELECTRON_VERSION_MISMATCH when the
// versions don't match. The build pipeline (`prepackage:chaterm`) runs this
// before invoking `build-chaterm.js`, so a mismatch fails fast and never
// produces a package with an ABI-incompatible Chaterm.

const fs = require('node:fs')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..')
const RAVEN_PKG = path.join(REPO_ROOT, 'package.json')
const CHATERM_PKG = path.join(REPO_ROOT, 'third_party', 'ChatermForRaven', 'package.json')

const ERROR_CODE = 'E_ELECTRON_VERSION_MISMATCH'

/**
 * Strip leading semver range operators (^, ~, >=, =, v) so we compare bare
 * versions. Returns the original string if it's already bare.
 */
function normalize(version) {
  if (typeof version !== 'string') return null
  return version.trim().replace(/^[v^~>=<\s]+/, '')
}

function readElectronVersion(pkgPath) {
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`${ERROR_CODE}: package.json missing at ${pkgPath}`)
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const version =
    pkg.devDependencies?.electron ?? pkg.dependencies?.electron ?? pkg.peerDependencies?.electron
  if (!version) {
    throw new Error(`${ERROR_CODE}: no electron version declared in ${pkgPath}`)
  }
  return { raw: version, normalized: normalize(version) }
}

function main() {
  let raven, chaterm
  try {
    raven = readElectronVersion(RAVEN_PKG)
    chaterm = readElectronVersion(CHATERM_PKG)
  } catch (err) {
    console.error(`[check-electron-version] ${err.message}`)
    process.exit(1)
  }

  if (raven.normalized !== chaterm.normalized) {
    console.error(`[check-electron-version] ${ERROR_CODE}`)
    console.error(`  Raven    package.json declares electron@${raven.raw}`)
    console.error(`  Chaterm  package.json declares electron@${chaterm.raw}`)
    console.error('  Both must pin the same Electron version (Raven and embedded Chaterm share one runtime).')
    console.error('  Fix: align `devDependencies.electron` in')
    console.error(`    - ${path.relative(REPO_ROOT, RAVEN_PKG)}`)
    console.error(`    - ${path.relative(REPO_ROOT, CHATERM_PKG)}`)
    process.exit(1)
  }

  console.log(`[check-electron-version] OK — both pin electron@${raven.normalized}`)
}

main()
