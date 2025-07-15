// src/main/services/packaging/VersionParser.ts

export class VersionParser {
  static validateVersion(version: string): boolean {
    return /^V?\d+\.\d+\.\d+\.\d+$/.test(version) || /^V?\d+\.\d+\.\d+$/.test(version);
  }

  static formatVersion(version: string): string {
    if (this.validateVersion(version)) {
      return version.startsWith('V') ? version : `V${version}`;
    }
    // Handle cases like v1001 -> V1.0.0.1, etc.
    const matchV4 = version.match(/v(\d)(\d)(\d)(\d)/);
    if (matchV4) {
      return `V${matchV4[1]}.${matchV4[2]}.${matchV4[3]}.${matchV4[4]}`;
    }
    return `V${version}`; // Fallback
  }

  static versionToNumeric(version: string): string {
    return version.replace(/[Vv.]/g, '');
  }

  static parseVersionFromFilename(filename: string): string | null {
    const patterns = [
      /v(\d)(\d)(\d)(\d)/,
      /V(\d+)\.(\d+)\.(\d+)\.(\d+)/,
      /(\d+)\.(\d+)\.(\d+)\.(\d+)/,
      /v(\d+)\.(\d+)\.(\d+)\.(\d+)/,
      /v(\d+)\.(\d+)\.(\d+)/,
      /V(\d+)\.(\d+)\.(\d+)/,
      /(\d+)\.(\d+)\.(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        if (pattern.source.includes('v(\\d)(\\d)(\\d)(\\d)')) {
           return `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
        }
        return match.slice(1).join('.');
      }
    }
    return null;
  }
}
