import { useCallback, useEffect, useState } from 'react'

import { Package, PackageMetadata } from '../types/package'

/**
 * Hook for managing packages
 */
export const usePackages = () => {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch all packages
   */
  const fetchPackages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.package.getAll()
      setPackages(result || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packages')
      console.error('Error fetching packages:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get a package by ID
   */
  const getPackageById = useCallback(async (id: string): Promise<Package | null> => {
    try {
      return await window.api.package.getById(id)
    } catch (err) {
      console.error('Error fetching package by ID:', err)
      return null
    }
  }, [])

  /**
   * Update package metadata
   */
  const updatePackageMetadata = useCallback(
    async (id: string, metadata: PackageMetadata): Promise<boolean> => {
      try {
        const success = await window.api.package.updateMetadata(id, metadata)
        if (success) {
          // Refresh packages list
          await fetchPackages()
        }
        return success
      } catch (err) {
        console.error('Error updating package metadata:', err)
        return false
      }
    },
    [fetchPackages]
  )

  /**
   * Delete a package
   */
  const deletePackage = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const success = await window.api.package.delete(id)
        if (success) {
          // Refresh packages list
          await fetchPackages()
        }
        return success
      } catch (err) {
        console.error('Error deleting package:', err)
        return false
      }
    },
    [fetchPackages]
  )

  /**
   * Scan for packages in the system
   */
  const scanForPackages = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await window.api.package.scanForPackages()
      // Refresh packages list after scanning
      await fetchPackages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for packages')
      console.error('Error scanning for packages:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchPackages])

  /**
   * Upload package to FTP server
   */
  const uploadToFTP = useCallback(async (id: string, ftpConfig: any): Promise<boolean> => {
    try {
      return await window.api.package.uploadToFTP(id, ftpConfig)
    } catch (err) {
      console.error('Error uploading to FTP:', err)
      return false
    }
  }, [])

  /**
   * Upload package to HTTP server
   */
  const uploadToHTTP = useCallback(async (id: string, httpConfig: any): Promise<boolean> => {
    try {
      return await window.api.package.uploadToHTTP(id, httpConfig)
    } catch (err) {
      console.error('Error uploading to HTTP:', err)
      return false
    }
  }, [])

  /**
   * Open package location in file explorer
   */
  const openPackageLocation = useCallback(async (path: string): Promise<void> => {
    try {
      await window.api.file.openPath(path)
    } catch (err) {
      console.error('Error opening package location:', err)
    }
  }, [])

  // Load packages on mount
  useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

  return {
    packages,
    loading,
    error,
    fetchPackages,
    getPackageById,
    updatePackageMetadata,
    deletePackage,
    scanForPackages,
    uploadToFTP,
    uploadToHTTP,
    openPackageLocation
  }
}
