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
        const fileName = file.toString()
        const baseName = path.basename(fileName)
        const ext = path.extname(fileName)

        // 支持两种匹配模式：
        // 1. 扩展名匹配（types中以.开头的项）
        // 2. 完整文件名匹配（types中不以.开头的项，用于无扩展名的文件如gnb-oam-lx10）
        const isTypeMatch = types.some((type) => {
          if (type.startsWith('.')) {
            // 扩展名匹配
            return ext === type
          } else {
            // 完整文件名匹配或包含匹配
            return baseName === type || baseName.includes(type)
          }
        })

        if (!isTypeMatch) {
          return false
        }

        // 如果没有提供nameHint，只要类型匹配就返回
        if (!nameHint) {
          return true
        }

        // 从nameHint中提取基础名称（去掉扩展名）
        // 例如：'cucp.deb' -> 'cucp', 'gnb-oam-lx10' -> 'gnb-oam-lx10'
        const nameHintBase = path.basename(nameHint, path.extname(nameHint))

        // 文件名必须包含nameHint的基础名称
        return fileName.includes(nameHintBase)
      })
      .map((f) => path.join(dir, f.toString()))
    return matchingFiles
  }

  isArchiveFile(filePath: string): boolean {
    const supportedArchives = ['.zip', '.tgz', '.tar.gz']
    return supportedArchives.includes(path.extname(filePath).toLowerCase())
  }

  /**
   * 在指定目录中查找release note文件
   * 支持大小写不敏感和模糊匹配
   */
  async findReleaseNoteFile(dir: string): Promise<string | null> {
    try {
      console.log(`[FileProcessor] 开始在目录中查找 release note 文件: ${dir}`)
      const allFiles = await this.getAllFilesRecursively(dir)
      console.log(`[FileProcessor] 找到 ${allFiles.length} 个文件`)

      if (allFiles.length > 0) {
        console.log(`[FileProcessor] 文件列表:`)
        allFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file}`)
        })
      }

      // 查找包含 "releasenote" 关键字的文件（大小写不敏感）
      const releaseNoteFile = allFiles.find((file) => {
        const fileName = path.basename(file).toLowerCase()
        console.log(`[FileProcessor] 检查文件: ${fileName}`)

        // 过滤掉 macOS 元数据文件（以 ._ 开头的文件）
        if (fileName.startsWith('._')) {
          console.log(`[FileProcessor] ⚠️ 跳过 macOS 元数据文件: ${fileName}`)
          return false
        }

        // 支持各种可能的命名方式
        const isMatch =
          fileName.includes('releasenote') ||
          fileName.includes('release-note') ||
          fileName.includes('release_note') ||
          fileName.includes('releasenotes') ||
          fileName.includes('release-notes') ||
          fileName.includes('release_notes')

        if (isMatch) {
          console.log(`[FileProcessor] ✅ 找到匹配的 release note 文件: ${file}`)
        }

        return isMatch
      })

      if (!releaseNoteFile) {
        console.log(`[FileProcessor] ❌ 未找到 release note 文件`)
      }

      return releaseNoteFile || null
    } catch (error) {
      console.error('[FileProcessor] 查找release note文件时出错:', error)
      return null
    }
  }

  /**
   * 读取release note文件的内容
   */
  async readReleaseNoteContent(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content.trim()
    } catch (error) {
      console.error('读取release note文件时出错:', error)
      return null
    }
  }

  /**
   * 从si.ini文件中解析Release Note内容
   * 查找 ---Release Note Starts--- 和 ---Release Note Ends--- 之间的内容
   */
  async parseReleaseNoteFromSiIni(siIniPath: string): Promise<string | null> {
    try {
      console.log(`[FileProcessor] 开始解析si.ini文件中的Release Note: ${siIniPath}`)

      // 检查文件是否存在
      if (!(await fs.pathExists(siIniPath))) {
        console.log(`[FileProcessor] si.ini文件不存在: ${siIniPath}`)
        return null
      }

      const content = await fs.readFile(siIniPath, 'utf-8')
      console.log(`[FileProcessor] 读取到si.ini文件内容，长度: ${content.length}`)

      // 查找Release Note标记
      const startMarker = '---Release Note Starts---'
      const endMarker = '---Release Note Ends---'

      const startIndex = content.indexOf(startMarker)
      const endIndex = content.indexOf(endMarker)

      if (startIndex === -1 || endIndex === -1) {
        console.log(`[FileProcessor] 未找到Release Note标记`)
        return null
      }

      if (startIndex >= endIndex) {
        console.log(`[FileProcessor] Release Note标记位置异常`)
        return null
      }

      // 提取Release Note内容
      const releaseNoteContent = content.substring(startIndex + startMarker.length, endIndex).trim()

      console.log(`[FileProcessor] ✅ 成功解析Release Note内容，长度: ${releaseNoteContent.length}`)

      return releaseNoteContent || null
    } catch (error) {
      console.error('[FileProcessor] 解析si.ini文件中的Release Note时出错:', error)
      return null
    }
  }

  /**
   * 在包目录中查找si.ini文件
   */
  async findSiIniFile(packageDir: string): Promise<string | null> {
    try {
      console.log(`[FileProcessor] 在包目录中查找si.ini文件: ${packageDir}`)

      // 直接检查包目录下的si.ini文件
      const siIniPath = path.join(packageDir, 'si.ini')
      if (await fs.pathExists(siIniPath)) {
        console.log(`[FileProcessor] ✅ 找到si.ini文件: ${siIniPath}`)
        return siIniPath
      }

      // 如果包目录是压缩文件，需要先解压
      if (this.isArchiveFile(packageDir)) {
        console.log(`[FileProcessor] 包是压缩文件，需要解压查找si.ini`)
        const extractedDir = await this.extractArchive(packageDir)
        const extractedSiIniPath = path.join(extractedDir, 'si.ini')

        if (await fs.pathExists(extractedSiIniPath)) {
          console.log(`[FileProcessor] ✅ 在解压目录中找到si.ini文件: ${extractedSiIniPath}`)
          return extractedSiIniPath
        }
      }

      console.log(`[FileProcessor] ❌ 未找到si.ini文件`)
      return null
    } catch (error) {
      console.error('[FileProcessor] 查找si.ini文件时出错:', error)
      return null
    }
  }

  /**
   * 递归获取目录下的所有文件
   */
  private async getAllFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = []

    const items = await fs.readdir(dir, { withFileTypes: true })

    for (const item of items) {
      const fullPath = path.join(dir, item.name)

      if (item.isDirectory()) {
        const subFiles = await this.getAllFilesRecursively(fullPath)
        files.push(...subFiles)
      } else {
        files.push(fullPath)
      }
    }

    return files
  }

  cleanupTempFiles() {
    fs.removeSync(this.tempDir)
  }
}
