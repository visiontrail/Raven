// src/main/services/__tests__/PackageService.integration.test.ts

import * as fs from 'fs-extra'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Package, PackageMetadata, PackageType } from '../../../renderer/src/types/package'
import { PackageService } from '../PackageService'

describe('PackageService Integration Tests', () => {
  let packageService: PackageService
  let tempDir: string
  let testPackage: Package

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join('/tmp', 'package-service-test-' + Date.now())
    await fs.ensureDir(tempDir)

    // Create a test package
    testPackage = {
      id: 'test-package-id',
      name: 'test-lingxi-10-v1.0.0.tgz',
      path: path.join(tempDir, 'test-lingxi-10-v1.0.0.tgz'),
      size: 1024,
      createdAt: new Date(),
      packageType: PackageType.LINGXI_10,
      version: '1.0.0',
      metadata: {
        isPatch: false,
        components: ['oam', 'cucp'],
        description: 'Test package for integration testing',
        tags: ['test', 'integration'],
        customFields: { testField: 'testValue' }
      }
    }

    // Create a dummy TGZ file
    await fs.writeFile(testPackage.path, 'dummy tgz content')

    // Initialize PackageService
    packageService = new PackageService()
  })

  afterEach(async () => {
    // Clean up temporary directory
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir)
    }
  })

  it('should add and retrieve a package', async () => {
    // Add package
    const addResult = await packageService.addPackage(testPackage)
    expect(addResult).toBe(true)

    // Retrieve package by ID
    const retrievedPackage = await packageService.getPackageById(testPackage.id)
    expect(retrievedPackage).toBeTruthy()
    expect(retrievedPackage?.name).toBe(testPackage.name)
    expect(retrievedPackage?.packageType).toBe(testPackage.packageType)
    expect(retrievedPackage?.version).toBe(testPackage.version)
  })

  it('should update package metadata', async () => {
    // Add package first
    await packageService.addPackage(testPackage)

    // Verify package was added
    const retrievedPackage = await packageService.getPackageById(testPackage.id)
    expect(retrievedPackage).toBeTruthy()
    expect(retrievedPackage?.metadata.isPatch).toBe(false) // Original value

    // Update metadata
    const newMetadata: PackageMetadata = {
      isPatch: true,
      components: ['updated-component'],
      description: 'Updated description',
      tags: ['updated'],
      customFields: { updatedField: 'updatedValue' }
    }

    const updateResult = await packageService.updatePackageMetadata(testPackage.id, newMetadata)
    expect(updateResult).toBe(true)

    // Verify update
    const updatedPackage = await packageService.getPackageById(testPackage.id)
    expect(updatedPackage?.metadata.isPatch).toBe(true)
    expect(updatedPackage?.metadata.description).toBe('Updated description')
    expect(updatedPackage?.metadata.components).toEqual(['updated-component'])
  })

  it('should delete a package', async () => {
    // Add package first
    await packageService.addPackage(testPackage)

    // Verify package exists
    let retrievedPackage = await packageService.getPackageById(testPackage.id)
    expect(retrievedPackage).toBeTruthy()

    // Delete package
    const deleteResult = await packageService.deletePackage(testPackage.id)
    expect(deleteResult).toBe(true)

    // Verify package is deleted
    retrievedPackage = await packageService.getPackageById(testPackage.id)
    expect(retrievedPackage).toBeNull()

    // Verify file is deleted
    const fileExists = await fs.pathExists(testPackage.path)
    expect(fileExists).toBe(false)
  })

  it('should get all packages', async () => {
    // Add multiple packages
    const package2 = { ...testPackage, id: 'test-package-2', name: 'test2.tgz', path: path.join(tempDir, 'test2.tgz') }
    await fs.writeFile(package2.path, 'dummy content 2')

    await packageService.addPackage(testPackage)
    await packageService.addPackage(package2)

    // Get all packages
    const allPackages = await packageService.getPackages()
    expect(allPackages.length).toBeGreaterThanOrEqual(2)

    const packageIds = allPackages.map((pkg) => pkg.id)
    expect(packageIds).toContain(testPackage.id)
    expect(packageIds).toContain(package2.id)
  })

  it('should scan packages in directory', async () => {
    // Create a separate directory for scanning to avoid interference
    const scanDir = path.join(tempDir, 'scan-test')
    await fs.ensureDir(scanDir)

    // Create multiple TGZ files in directory
    const tgzFiles = ['test1.tgz', 'test2.tar.gz', 'not-a-package.txt']
    for (const file of tgzFiles) {
      await fs.writeFile(path.join(scanDir, file), 'dummy content')
    }

    // Scan directory
    const scannedPackages = await packageService.scanPackagesInDirectory(scanDir)

    // Should find only TGZ files (2 files: .tgz and .tar.gz)
    expect(scannedPackages.length).toBe(2)

    // Verify package names
    const packageNames = scannedPackages.map((pkg) => pkg.name)
    expect(packageNames).toContain('test1.tgz')
    expect(packageNames).toContain('test2.tar.gz')
    expect(packageNames).not.toContain('not-a-package.txt')
  })

  it('should handle non-existent package operations gracefully', async () => {
    const nonExistentId = 'non-existent-package-id'

    // Try to get non-existent package
    const retrievedPackage = await packageService.getPackageById(nonExistentId)
    expect(retrievedPackage).toBeNull()

    // Try to update non-existent package
    const updateResult = await packageService.updatePackageMetadata(nonExistentId, testPackage.metadata)
    expect(updateResult).toBe(false)

    // Try to delete non-existent package
    const deleteResult = await packageService.deletePackage(nonExistentId)
    expect(deleteResult).toBe(false)
  })
})
