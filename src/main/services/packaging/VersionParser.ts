// src/main/services/packaging/VersionParser.ts

export class VersionParser {
  /**
   * 验证版本号格式
   */
  static validateVersion(version: string): boolean {
    // 移除可能的V前缀
    const cleanVersion = version.replace(/^V/i, '')
    const pattern = /^\d+\.\d+\.\d+\.\d+$/
    return pattern.test(cleanVersion)
  }

  /**
   * 格式化版本号，确保以V开头
   */
  static formatVersion(version: string): string {
    if (!version.startsWith('V')) {
      return `V${version}`
    }
    return version
  }

  /**
   * 将版本号转换为数字格式，用于文件名
   */
  static versionToNumeric(version: string): string {
    // 移除V前缀并将点替换为空
    const cleanVersion = version.replace(/^V/i, '').replace(/\./g, '')
    return cleanVersion
  }

  /**
   * 从文件名解析版本号
   */
  static parseVersionFromFilename(filename: string): string | null {
    const patterns = [
      // 十六进制格式: V00020A09 -> 0.2.10.9
      /[vV]([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/,
      // V1003 格式 (4位数字) -> 1.0.0.3
      /[vV](\d)(\d)(\d)(\d)/,
      // v1001 格式 (单个数字) - 保持向后兼容
      /v(\d)(\d)(\d)(\d)/,
      // 4段标准格式: v1.0.0.1, V1.0.0.1, 1.0.0.1
      /[vV]?(\d+)\.(\d+)\.(\d+)\.(\d+)/,
      // 3段格式: v1.0.0, V1.0.0, 1.0.0 - 自动补充build号为0
      /[vV]?(\d+)\.(\d+)\.(\d+)/
    ]

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i]
      const match = filename.match(pattern)
      if (match) {
        const groups = match.slice(1)

        if (i === 0 && groups.length === 4) {
          // 十六进制格式: V00020A09 -> 0.2.10.9
          const major = parseInt(groups[0], 16).toString()
          const minor = parseInt(groups[1], 16).toString()
          const patch = parseInt(groups[2], 16).toString()
          const build = parseInt(groups[3], 16).toString()
          return `${major}.${minor}.${patch}.${build}`
        } else if (i === 1 && groups.length === 4) {
          // V1003 格式 (4位数字) -> 1.0.0.3
          return `${groups[0]}.${groups[1]}.${groups[2]}.${groups[3]}`
        } else if (i === 2 && groups.length === 4) {
          // v1001 格式 (单个数字) - 保持向后兼容
          return `${groups[0]}.${groups[1]}.${groups[2]}.${groups[3]}`
        } else if (i === 3 && groups.length === 4) {
          // 4段标准格式: v1.0.0.1, V1.0.0.1, 1.0.0.1
          return `${groups[0]}.${groups[1]}.${groups[2]}.${groups[3]}`
        } else if (i === 4 && groups.length === 3) {
          // 3段格式: v1.0.0, V1.0.0, 1.0.0 - 自动补充build号为0
          return `${groups[0]}.${groups[1]}.${groups[2]}.0`
        }
      }
    }

    return null
  }


}
