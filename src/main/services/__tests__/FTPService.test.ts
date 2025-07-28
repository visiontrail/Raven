// src/main/services/__tests__/FTPService.test.ts

import * as fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FTPConfig } from '../../../renderer/src/types/package'
import { FTPService } from '../FTPService'

// Mock basic-ftp
interface MockClient {
  access: ReturnType<typeof vi.fn>
  uploadFrom: ReturnType<typeof vi.fn>
  ensureDir: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  trackProgress: ReturnType<typeof vi.fn>
  [key: string]: any // Allow for dynamic properties like trackProgressCallback
}

const mockClient: MockClient = {
  access: vi.fn(),
  uploadFrom: vi.fn(),
  ensureDir: vi.fn(),
  list: vi.fn(),
  close: vi.fn(),
  trackProgress: vi.fn()
}

vi.mock('basic-ftp', () => ({
  Client: vi.fn(() => mockClient)
}))

// Mock fs-extra
vi.mock('fs-extra', () => ({
  pathExists: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
  stat: vi.fn().mockImplementation(() => Promise.resolve(undefined))
}))

const mockedFs = vi.mocked(fs)

describe('FTPService', () => {
  let ftpService: FTPService

  const mockFtpConfig: FTPConfig = {
    host: 'ftp.example.com',
    port: 21,
    username: 'testuser',
    password: 'testpass',
    remotePath: '/uploads/test.tgz'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ftpService = new FTPService()

    // Default mocks
    vi.spyOn(mockedFs, 'pathExists').mockImplementation(() => Promise.resolve(true as any))
    vi.spyOn(mockedFs, 'stat').mockImplementation(() => Promise.resolve({ size: 1024 } as any))
    mockClient.access.mockResolvedValue(undefined)
    mockClient.uploadFrom.mockResolvedValue(undefined)
    mockClient.ensureDir.mockResolvedValue(undefined)
    mockClient.list.mockResolvedValue([])
    mockClient.close.mockImplementation(() => {})
    mockClient.trackProgress.mockImplementation((callback) => {
      // Store the callback to trigger it in tests
      mockClient.trackProgressCallback = callback
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const filePath = '/local/path/test.tgz'

      const result = await ftpService.uploadFile(filePath, mockFtpConfig)

      expect(result).toBe(true)
      expect(mockClient.access).toHaveBeenCalledWith({
        host: mockFtpConfig.host,
        port: mockFtpConfig.port,
        user: mockFtpConfig.username,
        password: mockFtpConfig.password,
        secure: false
      })
      expect(mockClient.uploadFrom).toHaveBeenCalledWith(filePath, mockFtpConfig.remotePath)
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should throw error when file does not exist', async () => {
      const filePath = '/local/path/nonexistent.tgz'
      vi.spyOn(mockedFs, 'pathExists').mockImplementation(() => Promise.resolve(false as any))

      await expect(ftpService.uploadFile(filePath, mockFtpConfig)).rejects.toThrow('File not found')
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should handle FTP connection errors', async () => {
      const filePath = '/local/path/test.tgz'
      mockClient.access.mockRejectedValue(new Error('Connection failed'))

      await expect(ftpService.uploadFile(filePath, mockFtpConfig)).rejects.toThrow('Connection failed')
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should handle upload errors', async () => {
      const filePath = '/local/path/test.tgz'
      mockClient.uploadFrom.mockRejectedValue(new Error('Upload failed'))

      await expect(ftpService.uploadFile(filePath, mockFtpConfig)).rejects.toThrow('Upload failed')
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should create remote directory if needed', async () => {
      const filePath = '/local/path/test.tgz'
      const configWithSubdir: FTPConfig = {
        ...mockFtpConfig,
        remotePath: '/uploads/subdir/test.tgz'
      }

      const result = await ftpService.uploadFile(filePath, configWithSubdir)

      expect(result).toBe(true)
      expect(mockClient.ensureDir).toHaveBeenCalledWith('/uploads/subdir')
    })

    it('should handle directory creation errors gracefully', async () => {
      const filePath = '/local/path/test.tgz'
      const configWithSubdir: FTPConfig = {
        ...mockFtpConfig,
        remotePath: '/uploads/subdir/test.tgz'
      }
      mockClient.ensureDir.mockRejectedValue(new Error('Permission denied'))

      // Should still succeed even if directory creation fails
      const result = await ftpService.uploadFile(filePath, configWithSubdir)

      expect(result).toBe(true)
      expect(mockClient.uploadFrom).toHaveBeenCalled()
    })

    it('should track upload progress when callback provided', async () => {
      const filePath = '/local/path/test.tgz'
      const progressCallback = vi.fn()

      // Mock file size
      vi.spyOn(mockedFs, 'stat').mockImplementation(() => Promise.resolve({ size: 2048 } as any))

      await ftpService.uploadFile(filePath, mockFtpConfig, progressCallback)

      // Simulate progress tracking
      expect(mockClient.trackProgress).toHaveBeenCalled()
      const trackProgressCallback = mockClient.trackProgress.mock.calls[0][0]

      // Call the callback with progress info
      trackProgressCallback({ bytes: 1024 })

      expect(progressCallback).toHaveBeenCalledWith({
        bytesTransferred: 1024,
        totalBytes: 2048,
        percentage: 50
      })
    })

    it('should handle zero-byte files in progress tracking', async () => {
      const filePath = '/local/path/empty.tgz'
      const progressCallback = vi.fn()

      // Mock empty file
      vi.spyOn(mockedFs, 'stat').mockImplementation(() => Promise.resolve({ size: 0 } as any))

      await ftpService.uploadFile(filePath, mockFtpConfig, progressCallback)

      // Simulate progress tracking with zero-byte file
      const trackProgressCallback = mockClient.trackProgress.mock.calls[0][0]
      trackProgressCallback({ bytes: 0 })

      expect(progressCallback).toHaveBeenCalledWith({
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0
      })
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const result = await ftpService.testConnection(mockFtpConfig)

      expect(result).toBe(true)
      expect(mockClient.access).toHaveBeenCalledWith({
        host: mockFtpConfig.host,
        port: mockFtpConfig.port,
        user: mockFtpConfig.username,
        password: mockFtpConfig.password,
        secure: false
      })
      expect(mockClient.list).toHaveBeenCalled()
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should handle connection test failures', async () => {
      mockClient.access.mockRejectedValue(new Error('Connection failed'))

      const result = await ftpService.testConnection(mockFtpConfig)

      expect(result).toBe(false)
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should handle list command failures', async () => {
      mockClient.list.mockRejectedValue(new Error('List failed'))

      const result = await ftpService.testConnection(mockFtpConfig)

      expect(result).toBe(false)
      expect(mockClient.close).toHaveBeenCalled()
    })
  })
})
