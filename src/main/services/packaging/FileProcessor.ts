// src/main/services/packaging/FileProcessor.ts
import archiver from 'archiver'
import decompress from 'decompress'
import { app } from 'electron'
import * as fs from 'fs-extra'
import * as path from 'path'

export class FileProcessor {
  private tempDir: string

  constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'cherry-studio-packager')
    fs.ensureDirSync(this.tempDir)
  }

  async extractArchive(sourcePath: string): Promise<string> {
    const destDir = path.join(this.tempDir, `extract_${Date.now()}`)
    await fs.ensureDir(destDir)
    await decompress(sourcePath, destDir)
    return destDir
  }

  async createTgzPackage(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath)
      const archive = archiver('tar', {
        gzip: true
      })

      output.on('close', () => resolve())
      archive.on('error', (err) => reject(err))

      archive.pipe(output)
      archive.directory(sourceDir, false)
      archive.finalize()
    })
  }

  async copyAndRenameFile(source: string, destDir: string, newName: string): Promise<string> {
    const destPath = path.join(destDir, newName)
    await fs.copy(source, destPath)
    return destPath
  }

  async findFilesByType(dir: string, types: string[], nameHint?: string): Promise<string[]> {
    // A simple implementation, can be improved with more specific logic
    const allFiles = await fs.readdir(dir, { recursive: true })
    const matchingFiles = allFiles
      .filter((file) => {
        const ext = path.extname(file.toString())
        return types.includes(ext) || (nameHint && file.toString().includes(nameHint))
      })
      .map((f) => path.join(dir, f.toString()))
    return matchingFiles
  }

  isArchiveFile(filePath: string): boolean {
    const supportedArchives = ['.zip', '.tgz', '.tar.gz']
    return supportedArchives.includes(path.extname(filePath).toLowerCase())
  }

  cleanupTempFiles() {
    fs.removeSync(this.tempDir)
  }
}
