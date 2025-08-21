import { describe, expect, it } from 'vitest'

import { Package, PackageType } from '../../../types/package'

// Test the sorting logic that would be used in PackageListView
describe('Package Sorting Logic', () => {
  const mockPackages: Package[] = [
    {
      id: '1',
      name: 'zebra-package.tgz',
      path: '/path/to/zebra-package.tgz',
      size: 1024000,
      createdAt: new Date('2023-05-15'),
      packageType: PackageType.LINGXI_10,
      version: '1.2.3',
      metadata: {
        isPatch: false,
        components: [],
        description: '',
        tags: [],
        customFields: {}
      }
    },
    {
      id: '2',
      name: 'alpha-package.tgz',
      path: '/path/to/alpha-package.tgz',
      size: 2048000,
      createdAt: new Date('2023-05-10'),
      packageType: PackageType.CONFIG,
      version: '2.0.1',
      metadata: {
        isPatch: true,
        components: [],
        description: '',
        tags: [],
        customFields: {}
      }
    },
    {
      id: '3',
      name: 'beta-package.tgz',
      path: '/path/to/beta-package.tgz',
      size: 512000,
      createdAt: new Date('2023-05-20'),
      packageType: PackageType.LINGXI_07A,
      version: '3.1.0',
      metadata: {
        isPatch: false,
        components: [],
        description: '',
        tags: [],
        customFields: {}
      }
    }
  ]

  const applySorting = (
    packages: Package[],
    field: 'created_at' | 'size' | 'name' | 'package_type',
    order: 'asc' | 'desc'
  ) => {
    return [...packages].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (field) {
        case 'created_at':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case 'size':
          aValue = a.size
          bValue = b.size
          break
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'package_type':
          aValue = a.packageType
          bValue = b.packageType
          break
        default:
          return 0
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1
      if (aValue > bValue) return order === 'asc' ? 1 : -1
      return 0
    })
  }

  it('should sort by name ascending', () => {
    const sorted = applySorting(mockPackages, 'name', 'asc')

    expect(sorted[0].name).toBe('alpha-package.tgz')
    expect(sorted[1].name).toBe('beta-package.tgz')
    expect(sorted[2].name).toBe('zebra-package.tgz')
  })

  it('should sort by name descending', () => {
    const sorted = applySorting(mockPackages, 'name', 'desc')

    expect(sorted[0].name).toBe('zebra-package.tgz')
    expect(sorted[1].name).toBe('beta-package.tgz')
    expect(sorted[2].name).toBe('alpha-package.tgz')
  })

  it('should sort by size ascending', () => {
    const sorted = applySorting(mockPackages, 'size', 'asc')

    expect(sorted[0].size).toBe(512000) // beta-package
    expect(sorted[1].size).toBe(1024000) // zebra-package
    expect(sorted[2].size).toBe(2048000) // alpha-package
  })

  it('should sort by size descending', () => {
    const sorted = applySorting(mockPackages, 'size', 'desc')

    expect(sorted[0].size).toBe(2048000) // alpha-package
    expect(sorted[1].size).toBe(1024000) // zebra-package
    expect(sorted[2].size).toBe(512000) // beta-package
  })

  it('should sort by created_at ascending', () => {
    const sorted = applySorting(mockPackages, 'created_at', 'asc')

    expect(sorted[0].createdAt).toEqual(new Date('2023-05-10')) // alpha-package
    expect(sorted[1].createdAt).toEqual(new Date('2023-05-15')) // zebra-package
    expect(sorted[2].createdAt).toEqual(new Date('2023-05-20')) // beta-package
  })

  it('should sort by created_at descending', () => {
    const sorted = applySorting(mockPackages, 'created_at', 'desc')

    expect(sorted[0].createdAt).toEqual(new Date('2023-05-20')) // beta-package
    expect(sorted[1].createdAt).toEqual(new Date('2023-05-15')) // zebra-package
    expect(sorted[2].createdAt).toEqual(new Date('2023-05-10')) // alpha-package
  })

  it('should sort by package_type ascending', () => {
    const sorted = applySorting(mockPackages, 'package_type', 'asc')

    expect(sorted[0].packageType).toBe(PackageType.CONFIG) // alpha-package
    expect(sorted[1].packageType).toBe(PackageType.LINGXI_07A) // beta-package
    expect(sorted[2].packageType).toBe(PackageType.LINGXI_10) // zebra-package
  })

  it('should sort by package_type descending', () => {
    const sorted = applySorting(mockPackages, 'package_type', 'desc')

    expect(sorted[0].packageType).toBe(PackageType.LINGXI_10) // zebra-package
    expect(sorted[1].packageType).toBe(PackageType.LINGXI_07A) // beta-package
    expect(sorted[2].packageType).toBe(PackageType.CONFIG) // alpha-package
  })

  it('should maintain original order for equal values', () => {
    // Create packages with same name to test stable sorting
    const sameNamePackages: Package[] = [
      { ...mockPackages[0], name: 'same-name.tgz', id: '1' },
      { ...mockPackages[1], name: 'same-name.tgz', id: '2' },
      { ...mockPackages[2], name: 'same-name.tgz', id: '3' }
    ]

    const sorted = applySorting(sameNamePackages, 'name', 'asc')

    // Should maintain original order when values are equal
    expect(sorted[0].id).toBe('1')
    expect(sorted[1].id).toBe('2')
    expect(sorted[2].id).toBe('3')
  })
})
