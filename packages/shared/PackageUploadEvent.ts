export type HTTPUploadStatus = 'started' | 'progress' | 'success' | 'failed' | 'cancelled'

export interface HTTPUploadProgress {
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speedBytesPerSecond: number
}

export interface HTTPUploadEventPayload extends HTTPUploadProgress {
  uploadId: string
  packageId: string
  fileName: string
  status: HTTPUploadStatus
  error?: string
}
