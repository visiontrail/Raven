// src/main/services/__tests__/PackageService.test.ts

import {vi} from 'vitest'

import {Package, PackageMetadata, PackageType} from '../../../renderer/src/types/package'

// Mock electron app
const mockApp = {
  getPath: vi.fn(() => '/tmp/test-user-data')
}

                vi.mock('electron', () => ({app: mockApp}))

// Mock fs-extra
vi.mock('fs-extra', () => ({
                      pathExists: vi.fn(),
                      readJSON: vi.fn(),
                      writeJSON: vi.fn(),
                      readdir: vi.fn(),
                      stat: vi.fn(),
                      unlink: vi.fn(),
                      readFile: vi.fn()
                    }))

// Mock extractMetadataFromTGZ
vi.mock('../../utils/packageUtils', () => ({extractMetadataFromTGZ: vi.fn()}))

// Mock FTPService
vi.mock('../FTPService', () => ({
                           ftpService:
                               {uploadFile: vi.fn(), testConnection: vi.fn()},
                           FTPUploadProgress: {}
                         }))

// Import after mocking
const {PackageService} = await import('../PackageService')
const mockedFs = vi.mocked(await import('fs-extra'))
const {extractMetadataFromTGZ: mockExtractMetadata} =
    vi.mocked(await import('../../utils/packageUtils'))
const {ftpService: mockFtpService} = vi.mocked(await import('../FTPService'))

describe('PackageService', () => {
  let packageService: PackageService
  const mockPackage: Package = {
  id: 'test-id-1', name: 'test-package.tgz', path: '/path/to/test-package.tgz',
      size: 1024, createdAt: new Date('2023-01-01'),
      packageType: PackageType.LINGXI_10, version: '1.0.0', metadata: {
        isPatch: false,
        components: ['oam', 'cucp'],
        description: 'Test package',
        tags: ['test'],
        customFields: {}
      }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  packageService = new PackageService()

  // Mock fs methods
  mockedFs.pathExists.mockResolvedValue(true)
  mockedFs.readJSON.mockResolvedValue([])
  mockedFs.writeJSON.mockResolvedValue()
  mockedFs.readdir.mockResolvedValue([])
  mockedFs.stat.mockResolvedValue({isFile: () => true} as any)
  mockedFs.unlink.mockResolvedValue()

  // Reset FTP service mocks
  mockFtpService.uploadFile.mockReset()
  mockFtpService.testConnection.mockReset()
    mockedFs.readFile.mockResolvedValue(Buffer.from('test'))
  })

  describe('getPackages', () => {
    it('should return empty array when no packages exist', async () => {
      const packages = await packageService.getPackages()
      expect(packages).toEqual([])
    })

    it('should return packages that exist on file system', async () => {
      // Add a package to the service
      await packageService.addPackage(mockPackage)

    const packages = await packageService.getPackages()
    expect(packages).toHaveLength(1)
      expect(packages[0]).toEqual(mockPackage)
    })

    it('should filter out packages that no longer exist on file system', async () => {
      // Add a package to the service
      await packageService.addPackage(mockPackage)

    // Mock file not existing
    mockedFs.pathExists.mockResolvedValue(false)

    const packages = await packageService.getPackages()
      expect(packages).toEqual([])
    })
  })

  describe('getPackageById', () => {
    it('should return null when package does not exist', async () => {
      const result = await packageService.getPackageById('non-existent-id')
      expect(result).toBeNull()
    })

    it('should return package when it exists and file exists', async () => {
      await packageService.addPackage(mockPackage)

    const result = await packageService.getPackageById(mockPackage.id)
      expect(result).toEqual(mockPackage)
    })

    it('should return null and remove package when file no longer exists', async () => {
      await packageService.addPackage(mockPackage)

    // Mock file not existing
    mockedFs.pathExists.mockResolvedValue(false)

    const result = await packageService.getPackageById(mockPackage.id)
      expect(result).toBeNull()
    })
  })

  describe('updatePackageMetadata', () => {
    it('should return false when package does not exist', async () => {
      const newMetadata: PackageMetadata = {
  isPatch: true, components: ['updated'], description: 'Updated description',
      tags: ['updated'], customFields: {updated: true}
      }

      const result = await packageService.updatePackageMetadata('non-existent-id', newMetadata)
      expect(result).toBe(false)
    })

    it('should update metadata successfully', async () => {
      await packageService.addPackage(mockPackage)

    const newMetadata: PackageMetadata =
    {
      isPatch: true, components: ['updated'],
          description: 'Updated description', tags: ['updated'],
          customFields: {updated: true}
    }

    const result =
        await packageService.updatePackageMetadata(mockPackage.id, newMetadata)
    expect(result).toBe(true)

    const updatedPackage = await packageService.getPackageById(mockPackage.id)
      expect(updatedPackage?.metadata).toEqual(newMetadata)
    })
  })

  describe('deletePackage', () => {
    it('should return false when package does not exist', async () => {
      const result = await packageService.deletePackage('non-existent-id')
      expect(result).toBe(false)
    })

    it('should delete package successfully', async () => {
      await packageService.addPackage(mockPackage)

    const result = await packageService.deletePackage(mockPackage.id)
    expect(result).toBe(true)
    expect(mockedFs.unlink).toHaveBeenCalledWith(mockPackage.path)

    const deletedPackage = await packageService.getPackageById(mockPackage.id)
      expect(deletedPackage).toBeNull()
    })

    it('should handle file deletion errors gracefully', async () => {
      await packageService.addPackage(mockPackage)

    // Mock file deletion error
    mockedFs.unlink.mockRejectedValue(new Error('Permission denied'))

    const result = await packageService.deletePackage(mockPackage.id)
      expect(result).toBe(false)
    })
  })

  describe('addPackage', () => {
    it('should add new package successfully', async () => {
      const result = await packageService.addPackage(mockPackage)
  expect(result).toBe(true)

  const addedPackage = await packageService.getPackageById(mockPackage.id)
      expect(addedPackage).toEqual(mockPackage)
    })

    it('should update existing package with same path', async () => {
      await packageService.addPackage(mockPackage)

    const updatedPackage =
    {
      ...mockPackage, id: 'different-id', name: 'updated-name.tgz',
          version: '2.0.0'
    }

    const result = await packageService.addPackage(updatedPackage)
    expect(result).toBe(true)

    // Should keep original ID but update other fields
    const retrievedPackage = await packageService.getPackageById(mockPackage.id)
    expect(retrievedPackage?.name).toBe('updated-name.tgz')
    expect(retrievedPackage?.version).toBe('2.0.0')
      expect(retrievedPackage?.id).toBe(mockPackage.id) // Original ID preserved
    })
  })

  describe('scanPackagesInDirectory', () => {
    it('should return empty array when directory does not exist', async () => {
      mockedFs.pathExists.mockResolvedValue(false)

  const packages = await packageService.scanPackagesInDirectory('/non-existent')
      expect(packages).toEqual([])
    })

    it('should scan and return TGZ packages from directory', async () => {
      mockExtractMetadata.mockResolvedValue(mockPackage)

    mockedFs.readdir.mockResolvedValue(
        ['test.tgz', 'other.txt', 'another.tar.gz'])

    const packages = await packageService.scanPackagesInDirectory('/test/dir')
    expect(packages).toHaveLength(2)  // Only .tgz and .tar.gz files
      expect(mockExtractMetadata).toHaveBeenCalledTimes(2)
    })
  })

  describe('uploadPackageToFTP', () => {
    it('should return false when package does not exist', async () => {
      const ftpConfig = {
  host: '172.16.9.224', port: 10002, username: 'anonymous',
      password: 'anonymous', remotePath: '/firmware'
      }

      const result = await packageService.uploadPackageToFTP('non-existent-id', ftpConfig)
      expect(result).toBe(false)
    })

    it('should handle FTP upload successfully', async () => {
      await packageService.addPackage(mockPackage)

    const ftpConfig = {
      host: 'ftp.example.com',
      port: 21,
      username: 'user',
      password: 'pass',
      remotePath: '/uploads'
    }

                      // Mock successful FTP upload
                      mockFtpService.uploadFile.mockResolvedValue(true)

    const result =
        await packageService.uploadPackageToFTP(mockPackage.id, ftpConfig)

    expect(result).toBe(true)
      expect(mockFtpService.uploadFile).toHaveBeenCalledWith(
        mockPackage.path,
        expect.objectContaining({
          host: ftpConfig.host,
          port: ftpConfig.port,
          username: ftpConfig.username,
          password: ftpConfig.password,
          remotePath: '/uploads/test-package.tgz'
        }),
        undefined
      )
    })

    it('should handle FTP upload failures', async () => {
      await packageService.addPackage(mockPackage)

    const ftpConfig = {
      host: 'ftp.example.com',
      port: 21,
      username: 'user',
      password: 'pass',
      remotePath: '/uploads'
    }

                      // Mock FTP upload failure
                      mockFtpService.uploadFile.mockRejectedValue(
                          new Error('FTP connection failed'))

    const result =
        await packageService.uploadPackageToFTP(mockPackage.id, ftpConfig)

      expect(result).toBe(false)
    })
  })

  describe('uploadPackageToHTTP', () => {
    it('should return false when package does not exist', async () => {
      const httpConfig = {
  url: 'https://api.example.com/upload', method: 'POST' as const, headers: {}
      }

      const result = await packageService.uploadPackageToHTTP('non-existent-id', httpConfig)
      expect(result).toBe(false)
    })

    it('should handle HTTP upload errors gracefully', async () => {
      await packageService.addPackage(mockPackage)

    const httpConfig =
    {
      url: 'https://api.example.com/upload', method: 'POST' as const,
          headers: {}
    }

    // Mock axios to throw error
    vi.doMock(
        'axios', () => vi.fn().mockRejectedValue(new Error('Network error')))

    const result =
        await packageService.uploadPackageToHTTP(mockPackage.id, httpConfig)
      expect(result).toBe(false)
    })
  })
})
