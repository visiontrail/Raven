// src/main/services/packaging/VersionParser.ts

export class VersionParser {
  /**
   * 验证版本号格式（基础四段）
   */
  static validateVersion(version: string): boolean {
    // 移除可能的V前缀
    const cleanVersion = version.replace(/^V/i, '')
    const pattern = /^\d+\.\d+\.\d+\.\d+$/
    return pattern.test(cleanVersion)
  }

  /**
   * 针对组件（CUCP/CUUP/DU/S-GNB）验证版本字符串
   * 允许形如: d.d.d.d 或 d.d.d.d-YYYYMMDDHHMM / d.d.d.d.YYYYMMDDHHMM
   */
  static validateComponentVersion(version: string, componentType?: string): boolean {
    const isCU = componentType ? ['cucp', 'cuup', 'du', 's-gnb', 'sgnb'].includes(componentType.toLowerCase()) : false

    const clean = version.replace(/^V/i, '')

    // 基础四段
    if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) return true

    // 仅对 CU 类组件校验带时间戳格式（兼容 - 或 . 分隔符）
    if (isCU) {
      const m = clean.match(/^(\d+\.\d+\.\d+\.\d+)(?:[.-](\d{12}))$/)
      if (m) {
        const ts = m[2]
        return this.validateTimestamp(ts)
      }
    }

    return false
  }

  /**
   * 格式化版本号，确保以V开头（若包含时间戳，保留）
   */
  static formatVersion(version: string): string {
    if (!version.startsWith('V')) {
      return `V${version}`
    }
    return version
  }

  /**
   * 将版本号转换为数字格式，用于文件名（仅处理四段版本，不处理时间戳）
   */
  static versionToNumeric(version: string): string {
    // 移除V前缀与可能的时间戳后缀（兼容 - 或 . 分隔的时间戳）
    const clean = version.replace(/^V/i, '')
    const m = clean.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)/)
    if (m) {
      return `${m[1]}${m[2]}${m[3]}${m[4]}`
    }
    // 回退：去除连字符时间戳再移除点
    const cleanVersion = clean.split('-')[0].replace(/\./g, '')
    return cleanVersion
  }

  /** 校验 YYYYMMDDHHMM 时间戳是否有效 */
  private static validateTimestamp(ts: string): boolean {
    if (!/^\d{12}$/.test(ts)) return false
    const year = parseInt(ts.slice(0, 4))
    const month = parseInt(ts.slice(4, 6))
    const day = parseInt(ts.slice(6, 8))
    const hour = parseInt(ts.slice(8, 10))
    const minute = parseInt(ts.slice(10, 12))
    if (month < 1 || month > 12) return false
    if (day < 1 || day > 31) return false
    if (hour < 0 || hour > 23) return false
    if (minute < 0 || minute > 59) return false
    if (year < 2000 || year > 2100) return false
    return true
  }

  /**
   * 猜测文件名中的组件类型
   */
  static detectComponentType(filename: string): 'cucp' | 'cuup' | 'du' | null {
    const m = filename.toLowerCase().match(/(^|[_.-])(cucp|cuup|du)(?=[_.-]|\b)/)
    return (m?.[2] as 'cucp' | 'cuup' | 'du') || null
  }

  /**
   * 从文件名解析版本号（支持 CUCP/CUUP/DU/S-GNB 的时间戳后缀）
   * 返回值不带 V 前缀，可能包含 .YYYYMMDDHHMM 后缀（统一点分格式）
   */
  static parseVersionFromFilename(filename: string, componentType?: string): string | null {
    const isCUComponent = (() => {
      if (componentType && ['cucp', 'cuup', 'du', 's-gnb', 'sgnb'].includes(componentType.toLowerCase())) return true
      const detected = this.detectComponentType(filename)
      if (detected !== null) return true
      // 额外支持包含 S-GNB 关键字的文件，按 CU 组件规则解析时间戳
      if (/(^|[_.-])s-?gnb(?=[_.-]|\b)/i.test(filename)) return true
      return false
    })()

    // 优先匹配 CU 类组件的时间戳格式: v1.2.3.4-YYYYMMDDHHMM / V1.2.3.4-YYYYMMDDHHMM / v1.2.3.4.YYYYMMDDHHMM
    if (isCUComponent) {
      const cuMatch = filename.match(/[vV]?(\d+)\.(\d+)\.(\d+)\.(\d+)[.-](\d{12})/)
      if (cuMatch) {
        const [, a, b, c, d, ts] = cuMatch
        if (this.validateTimestamp(ts)) {
          // 统一输出为点分格式
          return `${a}.${b}.${c}.${d}.${ts}`
        }
      }
    }

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
        } else if ((i === 1 || i === 2) && groups.length === 4) {
          // V1003 或 v1001 格式 -> 1.0.0.3
          return `${groups[0]}.${groups[1]}.${groups[2]}.${groups[3]}`
        } else if (i === 3 && groups.length === 4) {
          // 4段标准格式
          return `${groups[0]}.${groups[1]}.${groups[2]}.${groups[3]}`
        } else if (i === 4 && groups.length === 3) {
          // 3段标准格式，补0
          return `${groups[0]}.${groups[1]}.${groups[2]}.0`
        }
      }
    }

    return null
  }

  /**
   * 从版本字符串中提取详细信息
   */
  static parseDetailedVersion(version: string): {
    major: number
    minor: number
    patch: number
    build: number
    timestamp?: string
  } | null {
    const clean = version.replace(/^V/i, '')
    // 兼容 - 或 . 分隔的时间戳
    const m = clean.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:[.-](\d{12}))?$/)
    if (!m) return null
    const major = parseInt(m[1])
    const minor = parseInt(m[2])
    const patch = parseInt(m[3])
    const build = parseInt(m[4])
    const ts = m[5]
    if (ts && !this.validateTimestamp(ts)) return null
    return { major, minor, patch, build, timestamp: ts }
  }
}
