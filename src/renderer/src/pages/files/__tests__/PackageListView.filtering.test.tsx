import { describe, expect, it } from 'vitest'

import { Package, PackageType } from '../../../types/package'

// Test the filtering logic that would be used in PackageListView
describe('Package Filtering Logic', () => {
  const mockPackages: Package[] = [
    {
      id: '1',
      name: 'lingxi-10-v1.2.3.tgz',
      path: '/path/to/lingxi-10-v1.2.3.tgz',
      size: 1024000,
      createdAt: new Date('2023-05-15'),
      packageType: PackageType.LINGXI_10,
      version: '1.2.3',
      metadata: {
        isPatch: false,
        components: ['core', 'ui'],
        description: 'Main application package',
        tags: ['stable', 'production'],
        customFields: {}
      }
    },
    {
      id: '2',
      name: 'config-v2.0.1-patch.tgz',
      path: '/path/to/config-v2.0.1-patch.tgz',
      size: 512000,
      createdAt: new Date('2023-05-10'),
      packageType: PackageType.CONFIG,
      version: '2.0.1',
      metadata: {
        isPatch: true,
        components: ['config'],
        description: 'Configuration patch',
        tags: ['patch', 'hotfix'],
        customFields: {}
      }
    },
    {
      id: '3',
      name: 'lingxi-07a-v3.1.0.tgz',
      path: '/path/to/lingxi-07a-v3.1.0.tgz',
      size: 2048000,
      createdAt: new Date('2023-05-05'),
      packageType: PackageType.LINGXI_07A,
      version: '3.1.0',
      metadata: {
        isPatch: false,
        components: ['legacy', 'compatibility'],
        description: 'Legacy system package',
        tags: ['legacy'],
        customFields: {}
      }
    }
  ]

  const applyFilters = (
    packages: Package[],
    filters: {
      search: string
      packageType: PackageType | 'all'
      isPatch: 'all' | 'patch' | 'full'
    }
  ) => {
    return packages.filter((pkg) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesName = pkg.name.toLowerCase().includes(searchLower)
        const matchesDescription = pkg.metadata?.description?.toLowerCase().includes(searchLower) || false
        const matchesTags = pkg.metadata?.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) || false
        const matchesComponents =
          pkg.metadata?.components?.some((component) => component.toLowerCase().includes(searchLower)) || false

        if (!matchesName && !matchesDescription && !matchesTags && !matchesComponents) {
          return false
        }
      }

      // Package type filter
      if (filters.packageType !== 'all' && pkg.packageType !== filters.packageType) {
        return false
      }

      // Patch filter
      if (filters.isPatch !== 'all') {
        const isPatch = pkg.metadata?.isPatch || false
        if (filters.isPatch === 'patch' && !isPatch) return false
        if (filters.isPatch === 'full' && isPatch) return false
      }

      return true
    })
  }

  it('should filter by search term in package name', () => {
    const filtered = applyFilters(mockPackages, {
      search: 'lingxi-10',
      packageType: 'all',
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('lingxi-10-v1.2.3.tgz')
  })

  it('should filter by search term in description', () => {
    const filtered = applyFilters(mockPackages, {
      search: 'configuration',
      packageType: 'all',
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('config-v2.0.1-patch.tgz')
  })

  it('should filter by search term in tags', () => {
    const filtered = applyFilters(mockPackages, {
      search: 'production',
      packageType: 'all',
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('lingxi-10-v1.2.3.tgz')
  })

  it('should filter by search term in components', () => {
    const filtered = applyFilters(mockPackages, {
      search: 'legacy',
      packageType: 'all',
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('lingxi-07a-v3.1.0.tgz')
  })

  it('should filter by package type', () => {
    const filtered = applyFilters(mockPackages, {
      search: '',
      packageType: PackageType.CONFIG,
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].packageType).toBe(PackageType.CONFIG)
  })

  it('should filter by patch status - patch only', () => {
    const filtered = applyFilters(mockPackages, {
      search: '',
      packageType: 'all',
      isPatch: 'patch'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].metadata.isPatch).toBe(true)
  })

  it('should filter by patch status - full only', () => {
    const filtered = applyFilters(mockPackages, {
      search: '',
      packageType: 'all',
      isPatch: 'full'
    })

    expect(filtered).toHaveLength(2)
    filtered.forEach((pkg) => {
      expect(pkg.metadata.isPatch).toBe(false)
    })
  })

  it('should apply multiple filters simultaneously', () => {
    const filtered = applyFilters(mockPackages, {
      search: 'config',
      packageType: PackageType.CONFIG,
      isPatch: 'patch'
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('config-v2.0.1-patch.tgz')
    expect(filtered[0].packageType).toBe(PackageType.CONFIG)
    expect(filtered[0].metadata.isPatch).toBe(true)
  })

  it('should return empty array when no packages match filters', () => {
    const filtered = applyFilters(mockPackages, {
      search: 'nonexistent',
      packageType: 'all',
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(0)
  })

  it('should return all packages when no filters are applied', () => {
    const filtered = applyFilters(mockPackages, {
      search: '',
      packageType: 'all',
      isPatch: 'all'
    })

    expect(filtered).toHaveLength(3)
  })
})
