/**
 * Package type definitions for TGZ Package Management
 */

/**
 * Enum for package types
 */
export enum PackageType {
  LINGXI_10 = 'lingxi-10',
  LINGXI_07A = 'lingxi-07a',
  CONFIG = 'config',
  LINGXI_06TRD = 'lingxi-06-thrid'
}

/**
 * Interface for package metadata
 */
export interface PackageMetadata {
  /**
   * Whether it's a patch package
   */
  isPatch: boolean

  /**
   * Included components
   */
  components: (string | { name: string; version?: string })[]

  /**
   * User-provided description
   */
  description: string

  /**
   * User-defined tags
   */
  tags: string[]

  /**
   * Additional custom fields
   */
  customFields: Record<string, any>
}

/**
 * Interface for package information
 */
export interface Package {
  /**
   * Unique identifier
   */
  id: string

  /**
   * Package name
   */
  name: string

  /**
   * File system path
   */
  path: string

  /**
   * File size in bytes
   */
  size: number

  /**
   * Creation date
   */
  createdAt: Date

  /**
   * Type of package
   */
  packageType: PackageType

  /**
   * Package version
   */
  version: string

  /**
   * Additional metadata
   */
  metadata: PackageMetadata
}

/**
 * Interface for FTP configuration
 */
export interface FTPConfig {
  /**
   * FTP server host
   */
  host: string

  /**
   * FTP server port
   */
  port: number

  /**
   * FTP username
   */
  username: string

  /**
   * FTP password
   */
  password: string

  /**
   * Remote path on FTP server
   */
  remotePath: string
}

/**
 * Interface for HTTP configuration
 */
export interface HTTPConfig {
  /**
   * HTTP endpoint URL
   */
  url: string

  /**
   * HTTP method
   */
  method: 'POST' | 'PUT'

  /**
   * HTTP headers
   */
  headers: Record<string, string>

  /**
   * Authentication configuration
   */
  authentication?: {
    /**
     * Authentication type
     */
    type: 'Basic' | 'Bearer' | 'OAuth'

    /**
     * Authentication token
     */
    token?: string

    /**
     * Username for Basic authentication
     */
    username?: string

    /**
     * Password for Basic authentication
     */
    password?: string
  }
}
