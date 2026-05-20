require('dotenv').config()
const { notarize } = require('@electron/notarize')
const { execSync } = require('child_process')
const path = require('path')
const { verifySignedBinaries } = require('./verify-notarization')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  // Without Apple credentials, apply ad-hoc signing to ensure Team ID consistency
  // across the main binary and Electron Framework. Required for macOS 26+ which
  // enforces Team ID matching between process and loaded frameworks.
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('  • No Apple credentials found, applying ad-hoc signature for Team ID consistency...')
    try {
      const entitlementsPath = path.join(__dirname, '../build/entitlements.mac.plist')
      execSync(
        `codesign --force --deep --sign - --timestamp=none --entitlements "${entitlementsPath}" "${appPath}"`,
        { stdio: 'inherit' }
      )
      verifySignedBinaries(appPath, { log: (message) => console.log(`  • ${message}`) })
      console.log('  • Ad-hoc signing complete:', appPath)
    } catch (e) {
      console.warn('  • Ad-hoc signing failed (app may not run on macOS 26+):', e.message)
    }
    return
  }

  const signatureCheck = verifySignedBinaries(appPath, { log: (message) => console.log(`  • ${message}`) })
  if (signatureCheck.failures.length > 0) {
    const files = signatureCheck.failures.map((failure) => `\n    - ${failure.filePath}`).join('')
    throw new Error(`Unsigned embedded Chaterm native binaries found before notarization:${files}`)
  }

  await notarize({
    appPath,
    appBundleId: 'com.kangfenmao.CherryStudio',
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })

  console.log('  • Notarized app:', appPath)
}
