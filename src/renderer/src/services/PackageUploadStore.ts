import { HTTPUploadEventPayload, HTTPUploadStatus } from '@shared/PackageUploadEvent'
import { useSyncExternalStore } from 'react'

import { HTTPConfig } from '../types/package'

export interface UploadTaskState {
  uploadId: string
  packageId: string
  fileName: string
  status: HTTPUploadStatus
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speedBytesPerSecond: number
  error?: string
}

const uploadsById = new Map<string, UploadTaskState>()
const packageToUploadId = new Map<string, string>()
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (packageId: string): UploadTaskState | null => {
  const uploadId = packageToUploadId.get(packageId)
  if (!uploadId) return null
  return uploadsById.get(uploadId) || null
}

const upsertTask = (payload: HTTPUploadEventPayload) => {
  const task: UploadTaskState = {
    uploadId: payload.uploadId,
    packageId: payload.packageId,
    fileName: payload.fileName,
    status: payload.status,
    bytesTransferred: payload.bytesTransferred,
    totalBytes: payload.totalBytes,
    percentage: payload.percentage,
    speedBytesPerSecond: payload.speedBytesPerSecond,
    error: payload.error
  }

  uploadsById.set(payload.uploadId, task)
  packageToUploadId.set(payload.packageId, payload.uploadId)
  emit()

  if (['success', 'failed', 'cancelled'].includes(payload.status)) {
    setTimeout(() => {
      uploadsById.delete(payload.uploadId)
      packageToUploadId.delete(payload.packageId)
      emit()
    }, 8000)
  }
}

let removeIpcListener: (() => void) | null = null
const ensureIpcListener = () => {
  if (removeIpcListener || !window?.api?.package?.onHTTPUploadEvent) return
  removeIpcListener = window.api.package.onHTTPUploadEvent((event) => {
    upsertTask(event)
  })
}

ensureIpcListener()

export const useHttpUploadTask = (packageId: string) => {
  ensureIpcListener()
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(packageId),
    () => null
  )
}

export const startHttpUpload = async (packageId: string, httpConfig: HTTPConfig, fileName: string) => {
  ensureIpcListener()
  const uploadId = crypto.randomUUID ? crypto.randomUUID() : `upload-${Date.now()}`

  // optimistic state so UI shows immediately
  upsertTask({
    uploadId,
    packageId,
    fileName,
    status: 'started',
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speedBytesPerSecond: 0
  })

  try {
    const result = await window.api.package.uploadToHTTP(packageId, httpConfig, uploadId)
    if (!result?.success) {
      upsertTask({
        uploadId,
        packageId,
        fileName,
        status: 'failed',
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0,
        speedBytesPerSecond: 0,
        error: result?.error || '上传启动失败'
      })
    }
    return { uploadId, success: !!result?.success, error: result?.error }
  } catch (error) {
    upsertTask({
      uploadId,
      packageId,
      fileName,
      status: 'failed',
      bytesTransferred: 0,
      totalBytes: 0,
      percentage: 0,
      speedBytesPerSecond: 0,
      error: (error as Error).message
    })
    return { uploadId, success: false, error: (error as Error).message }
  }
}

export const cancelHttpUpload = async (uploadId: string) => {
  try {
    await window.api.package.cancelHTTPUpload(uploadId)
  } catch (error) {
    console.error('[PackageUploadStore] cancel upload failed', error)
  }
}
