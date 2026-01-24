// src/main/services/__tests__/HTTPService.test.ts

import axios from 'axios'
import FormData from 'form-data'
import * as fs from 'fs-extra'
import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HTTPConfig, Package } from '../../../renderer/src/types/package'
import { HTTPService } from '../HTTPService'

// Mock dependencies
vi.mock('fs-extra', () => ({
  pathExists: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
  stat: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
  createReadStream: vi.fn()
}))

vi.mock('axios', () => {
  const axiosMock: any = vi.fn()
  axiosMock.isAxiosError = vi.fn()
  return {
    default: axiosMock,
    isAxiosError: axiosMock.isAxiosError
  }
})

// Mock FormData constructor
const MockFormDataInstance = {
  append: vi.fn(),
  getHeaders: vi.fn().mockReturnValue({ 'content-type': 'multipart/form-data' }),
  getLength: vi.fn()
}

vi.mock('form-data', () => ({
  default: vi.fn(() => MockFormDataInstance)
}))

const mockedFs = vi.mocked(fs)
const mockedAxios = vi.mocked(axios)
const MockedFormData = vi.mocked(FormData)

describe('HTTPService', () => {
  let httpService: HTTPService

  const mockHttpConfig: HTTPConfig = {
    url: 'https://example.com/upload',
    method: 'POST',
    headers: {
      'X-Custom-Header': 'test-value'
    }
  }

  const mockPackageMetadata: Package = {
    id: 'test-package-id',
    name: 'test-package',
    path: '/path/to/package.tgz',
    size: 1024,
    createdAt: new Date(),
    version: '1.0.0',
    packageType: 'config' as any,
    metadata: {
      isPatch: false,
      components: ['core', 'ui'],
      description: 'Test package',
      tags: ['test'],
      customFields: {}
    }
  }

  const mockFilePath = '/path/to/package.tgz'

  beforeEach(() => {
    vi.clearAllMocks()
    httpService = new HTTPService()

    // Mock fs methods - use mockImplementation instead of mockResolvedValue to avoid type issues
    vi.spyOn(mockedFs, 'pathExists').mockImplementation(() => Promise.resolve(true as any))
    vi.spyOn(mockedFs, 'stat').mockImplementation(() => Promise.resolve({ size: 1024 } as any))
    vi.spyOn(mockedFs, 'createReadStream').mockImplementation(() => {
      const stream = new PassThrough()
      // emit a small chunk and end so hash calculation can finish immediately
      process.nextTick(() => {
        stream.write(Buffer.from('test'))
        stream.end()
      })
      return stream as any
    })

    // Reset FormData mock
    MockFormDataInstance.append.mockClear()
    MockFormDataInstance.getHeaders.mockReturnValue({ 'content-type': 'multipart/form-data' })
    MockFormDataInstance.getLength.mockImplementation((cb: (err: any, length: number) => void) => cb(null, 2048))

    // Mock axios
    mockedAxios.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { success: true }
    } as any)

    // Mock axios.isAxiosError
    vi.mocked(axios.isAxiosError).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('uploadFile', () => {
    it('should successfully upload a file with metadata', async () => {
      const result = await httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig)

      expect(result).toBe(true)
      expect(mockedFs.pathExists).toHaveBeenCalledWith(mockFilePath)
      expect(mockedFs.stat).toHaveBeenCalledWith(mockFilePath)
      expect(mockedFs.createReadStream).toHaveBeenCalledWith(mockFilePath)
      expect(MockedFormData).toHaveBeenCalled()
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://example.com/upload',
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value',
            'content-type': 'multipart/form-data',
            'Content-Length': 2048
          })
        })
      )
    })

    it('should throw error when file does not exist', async () => {
      vi.spyOn(mockedFs, 'pathExists').mockImplementation(() => Promise.resolve(false as any))

      await expect(httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig)).rejects.toThrow(
        'File not found: /path/to/package.tgz'
      )
    })

    it('should handle server error response', async () => {
      const axiosError = {
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        }
      }

      mockedAxios.mockRejectedValue(axiosError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig)).rejects.toThrow(
        'Server responded with error 500: Internal Server Error'
      )
    })

    it('should handle connection refused error', async () => {
      const axiosError = {
        code: 'ECONNREFUSED'
      }

      mockedAxios.mockRejectedValue(axiosError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig)).rejects.toThrow(
        'Connection refused: Unable to connect to the server'
      )
    })

    it('should handle timeout error', async () => {
      const axiosError = {
        code: 'ETIMEDOUT'
      }

      mockedAxios.mockRejectedValue(axiosError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig)).rejects.toThrow(
        'Request timeout: The server did not respond within the expected time'
      )
    })

    it('should add Basic authentication when provided', async () => {
      const configWithAuth: HTTPConfig = {
        ...mockHttpConfig,
        authentication: {
          type: 'Basic',
          username: 'testuser',
          password: 'testpass'
        }
      }

      await httpService.uploadFile(mockFilePath, mockPackageMetadata, configWithAuth)

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          })
        })
      )
    })

    it('should add Bearer authentication when provided', async () => {
      const configWithAuth: HTTPConfig = {
        ...mockHttpConfig,
        authentication: {
          type: 'Bearer',
          token: 'test-token'
        }
      }

      await httpService.uploadFile(mockFilePath, mockPackageMetadata, configWithAuth)

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      )
    })

    it('should call progress callback during upload', async () => {
      const progressCallback = vi.fn()

      const hashStream = new PassThrough()
      const uploadStream = new PassThrough()
      let callCount = 0
      mockedFs.createReadStream.mockImplementation(() => {
        const stream = callCount === 0 ? hashStream : uploadStream
        callCount += 1
        setImmediate(() => {
          stream.write(Buffer.alloc(512))
          stream.end()
        })
        return stream as any
      })

      const uploadPromise = httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig, {
        onProgress: progressCallback
      })

      await uploadPromise

      expect(progressCallback).toHaveBeenCalled()
      const lastPayload = progressCallback.mock.calls.at(-1)?.[0]
      expect(lastPayload).toMatchObject({
        totalBytes: 2048
      })
    })

    it('should surface user cancellation as AbortError', async () => {
      const cancelError: any = new Error('canceled')
      cancelError.code = 'ERR_CANCELED'

      mockedAxios.mockRejectedValue(cancelError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(httpService.uploadFile(mockFilePath, mockPackageMetadata, mockHttpConfig)).rejects.toMatchObject({
        name: 'AbortError',
        message: 'Upload cancelled by user'
      })
    })
  })

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        statusText: 'OK'
      } as any)

      const result = await httpService.testConnection(mockHttpConfig)

      expect(result).toBe(true)
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'HEAD',
          url: 'https://example.com/upload',
          timeout: 10000
        })
      )
    })

    it('should return false for failed connection test', async () => {
      mockedAxios.mockRejectedValue(new Error('Connection failed'))

      const result = await httpService.testConnection(mockHttpConfig)

      expect(result).toBe(false)
    })

    it('should try OPTIONS method when HEAD returns 405', async () => {
      // First call (HEAD) returns 405
      mockedAxios
        .mockRejectedValueOnce({
          response: { status: 405 }
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK'
        } as any)

      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      const result = await httpService.testConnection(mockHttpConfig)

      expect(result).toBe(true)

      expect(mockedAxios).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: 'HEAD' }))
      expect(mockedAxios).toHaveBeenNthCalledWith(2, expect.objectContaining({ method: 'OPTIONS' }))
    })

    it('should add authentication to connection test', async () => {
      const configWithAuth: HTTPConfig = {
        ...mockHttpConfig,
        authentication: {
          type: 'Bearer',
          token: 'test-token'
        }
      }

      await httpService.testConnection(configWithAuth)

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      )
    })
  })
})
