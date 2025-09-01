// src/main/services/packaging/PackageScanner.ts

import { app } from 'electron'
import * as fs from 'fs-extra'
import * as path from 'path'

import { Package } from '../../../renderer/src/types/package'
import { extractMetadataFromTGZ } from '../../utils/packageUtils'

/**
 * Scanner for detecting and indexing TGZ packages
 */
export class PackageScanner {
  private packageDirectories: string[]

  /**
   * Create a new PackageScanner
   * @param directories Optional list of directories to scan. If not provided, defaults to standard locations.
   */
  constructor(directories?: string[]) {
    this.packageDirectories = directories || [
      path.join(app.getPath('downloads')),
      path.join(app.getPath('userData'), 'packages')
    ]

    // Ensure the packages directory exists
    fs.ensureDirSync(path.join(app.getPath('userData'), 'packages'))
  }

  /**
   * Scan all configured directories for TGZ packages
   * @returns Array of Package objects
   */
  async scanForPackages(): Promise<Package[]> {
    const packages: Package[] = []

    for (const directory of this.packageDirectories) {
      if (await fs.pathExists(directory)) {
        const files = await fs.readdir(directory)

        for (const file of files) {
          const filePath = path.join(directory, file)
          const stats = await fs.stat(filePath)

          if (stats.isFile() && this.isTgzPackage(file)) {
            try {
              const packageInfo = await extractMetadataFromTGZ(filePath)
              packages.push(packageInfo)
            } catch (error) {
              console.error(`Error processing package ${file}:`, error)
            }
          }
        }
      }
    }

    return packages
  }

  /**
   * Check if a file is a TGZ package based on extension and naming patterns
   * @param fileName Name of the file to check
   * @returns True if the file appears to be a TGZ package
   */
  private isTgzPackage(fileName: string): boolean {
    const lowerFileName = fileName.toLowerCase()

    // Check file extension
    if (!lowerFileName.endsWith('.tgz') && !lowerFileName.endsWith('.tar.gz')) {
      return false
    }

    // Check for common package naming patterns
    const packagePatterns = ['galaxyspace', 'lingxi', 'lx10', 'lx07a', 'config', 'trd', 'patch']

    return packagePatterns.some((pattern) => lowerFileName.includes(pattern))
  }

  /**
   * Watch directories for new TGZ packages
   * @param callback Function to call when a new package is detected
   * @returns Function to stop watching
   */
  watchForNewPackages(callback: (packageInfo: Package) => void): () => void {
    const watchers = this.packageDirectories.map((directory) => {
      if (!fs.existsSync(directory)) {
        fs.ensureDirSync(directory)
      }

      const watcher = fs.watch(directory, async (eventType, fileName) => {
        if (eventType === 'rename' && fileName && this.isTgzPackage(fileName)) {
          const filePath = path.join(directory, fileName)

          // Check if the file exists and is fully written
          try {
            // Wait a moment to ensure the file is fully written
            await new Promise((resolve) => setTimeout(resolve, 500))

            if (await fs.pathExists(filePath)) {
              const stats = await fs.stat(filePath)

              if (stats.isFile() && stats.size > 0) {
                const packageInfo = await extractMetadataFromTGZ(filePath)
                callback(packageInfo)
              }
            }
          } catch (error) {
            console.error(`Error processing new package ${fileName}:`, error)
          }
        }
      })

      return watcher
    })

    // Return a function to stop watching
    return () => {
      watchers.forEach((watcher) => watcher.close())
    }
  }
}
