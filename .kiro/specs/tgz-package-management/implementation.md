# TGZ Package Management Implementation Plan

## Overview

This document outlines the detailed implementation plan for the TGZ Package Management feature in Cherry Studio. Based on the design document, we'll implement a comprehensive solution for managing TGZ packages with capabilities for viewing, organizing, and performing operations on packages.

## Implementation Phases

### Phase 1: Core Package Management (2 weeks)

#### Week 1: Database and Service Layer

1. **Database Schema Implementation**
   - Create database migration for the `packages` table
   - Implement database access methods (CRUD operations)
   - Set up indexing for efficient queries

2. **Core Service Implementation**
   - Implement `PackageService` with basic functionality:
     - Package listing
     - Package metadata retrieval
     - Package creation hooks
   - Implement `FileSystemService` for file operations:
     - File path management
     - File information retrieval
     - Basic file operations (open, delete)

3. **Package Detection and Indexing**
   - Create a package scanner to detect existing TGZ packages
   - Implement metadata extraction from TGZ files
   - Set up automatic indexing of newly created packages

#### Week 2: UI Integration

1. **Package List View**
   - Create `PackageListView` component
   - Implement basic listing functionality
   - Add selection and basic interaction handlers

2. **Package Detail View**
   - Create `PackageDetailView` component
   - Implement metadata display
   - Add basic action buttons (open location)

3. **Integration with Files Section**
   - Add "Packages" category to the Files section
   - Implement navigation and routing
   - Connect UI components with services

### Phase 2: Enhanced Package Operations (2 weeks)

#### Week 3: Advanced Package Management

1. **Package Metadata Editing**
   - Implement metadata editing UI
   - Create update functionality in `PackageService`
   - Add validation and error handling

2. **Package Deletion**
   - Implement deletion confirmation dialog
   - Add deletion functionality to UI
   - Implement cleanup of database records and files

3. **Package Filtering and Sorting**
   - Create `PackageFilterBar` component
   - Implement sorting by various criteria (date, size, name, type)
   - Add filtering by package type and custom tags

#### Week 4: Search and Batch Operations

1. **Search Functionality**
   - Implement search by package name and metadata
   - Add search highlighting
   - Create search results view

2. **Batch Operations**
   - Implement multi-select functionality
   - Add batch delete operation
   - Implement batch metadata editing

3. **UI Refinements**
   - Add loading states and indicators
   - Implement error handling and user feedback
   - Add animations and transitions

### Phase 3: External Integrations (2 weeks)

#### Week 5: Upload Functionality

1. **FTP Integration**
   - Implement `FTPService`
   - Create FTP configuration UI
   - Add progress tracking and error handling

2. **HTTP Integration**
   - Implement `HTTPService`
   - Create HTTP configuration UI
   - Add authentication options

3. **Upload UI**
   - Create upload dialog
   - Implement server selection
   - Add upload progress indicators

#### Week 6: Advanced Features and Testing

1. **Package Versioning**
   - Implement version comparison
   - Add version history view
   - Create version tagging functionality

2. **Package Analytics**
   - Add package usage statistics
   - Implement package size analysis
   - Create visualization components

3. **Final Testing and Refinement**
   - Conduct end-to-end testing
   - Fix identified issues
   - Optimize performance

## Technical Implementation Details

### Database Implementation

We'll use the application's existing database system with the following implementation:

```typescript
// src/main/database/models/package.ts
import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database'

class Package extends Model {
  public id!: string
  public name!: string
  public path!: string
  public size!: number
  public createdAt!: Date
  public packageType!: string
  public version!: string
  public metadata!: any
}

Package.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false
    },
    size: {
      type: DataTypes.NUMBER,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    packageType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'packages'
  }
)

export default Package
```

### Service Layer Implementation

#### Package Service

```typescript
// src/main/services/PackageService.ts
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import Package from '../database/models/package'
import { extractMetadataFromTGZ } from '../utils/packageUtils'
import { FileSystemService } from './FileSystemService'
import { FTPService } from './FTPService'
import { HTTPService } from './HTTPService'

export class PackageService {
  private fileSystemService: FileSystemService
  private ftpService: FTPService
  private httpService: HTTPService

  constructor() {
    this.fileSystemService = new FileSystemService()
    this.ftpService = new FTPService()
    this.httpService = new HTTPService()
  }

  async getPackages(filters = {}, sortBy = 'createdAt', sortOrder = 'DESC') {
    return Package.findAll({
      where: filters,
      order: [[sortBy, sortOrder]]
    })
  }

  async getPackageById(id: string) {
    return Package.findByPk(id)
  }

  async updatePackageMetadata(id: string, metadata: any) {
    const pkg = await Package.findByPk(id)
    if (!pkg) return false

    pkg.metadata = { ...pkg.metadata, ...metadata }
    await pkg.save()
    return true
  }

  async deletePackage(id: string) {
    const pkg = await Package.findByPk(id)
    if (!pkg) return false

    try {
      await this.fileSystemService.deletePackageFile(pkg.path)
      await pkg.destroy()
      return true
    } catch (error) {
      console.error('Failed to delete package:', error)
      return false
    }
  }

  async scanForPackages(directory: string) {
    const files = await fs.readdir(directory)
    const tgzFiles = files.filter((file) => file.endsWith('.tgz'))

    for (const file of tgzFiles) {
      const filePath = path.join(directory, file)
      const stats = await fs.stat(filePath)

      // Check if package already exists in database
      const existingPackage = await Package.findOne({ where: { path: filePath } })
      if (existingPackage) continue

      // Extract metadata and create new package record
      const metadata = await extractMetadataFromTGZ(filePath)
      const packageType = this.determinePackageType(file)
      const version = this.extractVersion(file)

      await Package.create({
        id: uuidv4(),
        name: file,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        packageType,
        version,
        metadata
      })
    }
  }

  async uploadPackageToFTP(id: string, ftpConfig: any) {
    const pkg = await Package.findByPk(id)
    if (!pkg) return false

    return this.ftpService.uploadFile(pkg.path, ftpConfig)
  }

  async uploadPackageToHTTP(id: string, httpConfig: any) {
    const pkg = await Package.findByPk(id)
    if (!pkg) return false

    return this.httpService.uploadFile(pkg.path, pkg.metadata, httpConfig)
  }

  private determinePackageType(fileName: string): string {
    if (fileName.includes('lingxi-10')) return 'lingxi-10'
    if (fileName.includes('lingxi-07a')) return 'lingxi-07a'
    if (fileName.includes('config')) return 'config'
    if (fileName.includes('lingxi-06-thrid')) return 'lingxi-06-thrid'
    return 'unknown'
  }

  private extractVersion(fileName: string): string {
    const versionMatch = fileName.match(/v(\d+\.\d+\.\d+)/)
    return versionMatch ? versionMatch[1] : ''
  }
}
```

#### File System Service

```typescript
// src/main/services/FileSystemService.ts
import fs from 'fs/promises'
import { shell } from 'electron'
import path from 'path'

export class FileSystemService {
  async openPackageLocation(filePath: string) {
    try {
      await shell.showItemInFolder(filePath)
      return true
    } catch (error) {
      console.error('Failed to open package location:', error)
      return false
    }
  }

  async deletePackageFile(filePath: string) {
    try {
      await fs.unlink(filePath)
      return true
    } catch (error) {
      console.error('Failed to delete package file:', error)
      return false
    }
  }

  async getPackageFileInfo(filePath: string) {
    try {
      const stats = await fs.stat(filePath)
      return {
        exists: true,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      }
    } catch (error) {
      return {
        exists: false,
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  }
}
```

### UI Components Implementation

#### Package List Component

```tsx
// src/renderer/src/pages/Files/PackageList.tsx
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Package, Trash2, FolderOpen, Upload } from 'lucide-react'
import { formatFileSize, formatDate } from '@renderer/utils/formatters'

const PackageList: React.FC = () => {
  const { t } = useTranslation()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('DESC')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadPackages()
  }, [sortBy, sortOrder, filter])

  const loadPackages = async () => {
    setLoading(true)
    try {
      const filters = filter !== 'all' ? { packageType: filter } : {}
      const result = await window.electron.ipcRenderer.invoke('package:getAll', {
        filters,
        sortBy,
        sortOrder
      })
      setPackages(result)
    } catch (error) {
      console.error('Failed to load packages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePackageClick = (pkg) => {
    setSelectedPackage(pkg)
  }

  const handleOpenLocation = async (pkg) => {
    await window.electron.ipcRenderer.invoke('package:openLocation', pkg.id)
  }

  const handleDeletePackage = async (pkg) => {
    if (confirm(t('packages.confirmDelete'))) {
      await window.electron.ipcRenderer.invoke('package:delete', pkg.id)
      loadPackages()
      if (selectedPackage?.id === pkg.id) {
        setSelectedPackage(null)
      }
    }
  }

  const handleSortChange = (event) => {
    setSortBy(event.target.value)
  }

  const handleSortOrderChange = () => {
    setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')
  }

  const handleFilterChange = (event) => {
    setFilter(event.target.value)
  }

  return (
    <Container>
      <FilterBar>
        <SortSelect value={sortBy} onChange={handleSortChange}>
          <option value="createdAt">{t('packages.sortByDate')}</option>
          <option value="name">{t('packages.sortByName')}</option>
          <option value="size">{t('packages.sortBySize')}</option>
        </SortSelect>
        <SortOrderButton onClick={handleSortOrderChange}>{sortOrder === 'ASC' ? '↑' : '↓'}</SortOrderButton>
        <FilterSelect value={filter} onChange={handleFilterChange}>
          <option value="all">{t('packages.filterAll')}</option>
          <option value="lingxi-10">{t('packages.filterLingxi10')}</option>
          <option value="lingxi-07a">{t('packages.filterLingxi07a')}</option>
          <option value="config">{t('packages.filterConfig')}</option>
          <option value="lingxi-06-thrid">{t('packages.filterLingxi06Thrid')}</option>
        </FilterSelect>
      </FilterBar>

      {loading ? (
        <LoadingIndicator>{t('common.loading')}</LoadingIndicator>
      ) : (
        <PackageListContainer>
          {packages.length === 0 ? (
            <EmptyState>{t('packages.noPackages')}</EmptyState>
          ) : (
            packages.map((pkg) => (
              <PackageItem
                key={pkg.id}
                onClick={() => handlePackageClick(pkg)}
                selected={selectedPackage?.id === pkg.id}>
                <PackageIcon>
                  <Package size={18} />
                </PackageIcon>
                <PackageInfo>
                  <PackageName>{pkg.name}</PackageName>
                  <PackageDetails>
                    {formatFileSize(pkg.size)} | {formatDate(pkg.createdAt)} | {pkg.packageType}
                  </PackageDetails>
                </PackageInfo>
                <PackageActions>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenLocation(pkg)
                    }}>
                    <FolderOpen size={16} />
                  </ActionButton>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePackage(pkg)
                    }}>
                    <Trash2 size={16} />
                  </ActionButton>
                </PackageActions>
              </PackageItem>
            ))
          )}
        </PackageListContainer>
      )}

      {selectedPackage && (
        <PackageDetailPanel>
          <DetailHeader>{t('packages.details')}</DetailHeader>
          <DetailSection>
            <DetailTitle>{t('packages.generalInfo')}</DetailTitle>
            <DetailItem>
              <DetailLabel>{t('packages.name')}:</DetailLabel>
              <DetailValue>{selectedPackage.name}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('packages.type')}:</DetailLabel>
              <DetailValue>{selectedPackage.packageType}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('packages.version')}:</DetailLabel>
              <DetailValue>{selectedPackage.version || t('common.unknown')}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('packages.size')}:</DetailLabel>
              <DetailValue>{formatFileSize(selectedPackage.size)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>{t('packages.created')}:</DetailLabel>
              <DetailValue>{formatDate(selectedPackage.createdAt)}</DetailValue>
            </DetailItem>
          </DetailSection>

          <DetailSection>
            <DetailTitle>{t('packages.metadata')}</DetailTitle>
            {selectedPackage.metadata ? (
              Object.entries(selectedPackage.metadata).map(([key, value]) => (
                <DetailItem key={key}>
                  <DetailLabel>{key}:</DetailLabel>
                  <DetailValue>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</DetailValue>
                </DetailItem>
              ))
            ) : (
              <DetailItem>{t('packages.noMetadata')}</DetailItem>
            )}
          </DetailSection>

          <ActionButtons>
            <ActionButton onClick={() => handleOpenLocation(selectedPackage)}>
              <FolderOpen size={16} />
              {t('packages.openLocation')}
            </ActionButton>
            <ActionButton onClick={() => handleDeletePackage(selectedPackage)}>
              <Trash2 size={16} />
              {t('packages.delete')}
            </ActionButton>
            <ActionButton>
              <Upload size={16} />
              {t('packages.upload')}
            </ActionButton>
          </ActionButtons>
        </PackageDetailPanel>
      )}
    </Container>
  )
}

// Styled components would be defined here

export default PackageList
```

#### Integration with Files Section

```tsx
// src/renderer/src/pages/Files/Files.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import { Folder, Package, FileText } from 'lucide-react'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import FileExplorer from './FileExplorer'
import PackageList from './PackageList'
import DocumentList from './DocumentList'

const Files: React.FC = () => {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  const isRoute = (path: string): string => (pathname.includes(path) ? 'active' : '')

  return (
    <Container>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('files.title')}</NavbarCenter>
      </Navbar>
      <ContentContainer>
        <FilesMenu>
          <MenuItemLink to="/files/explorer">
            <MenuItem className={isRoute('/files/explorer')}>
              <Folder size={18} />
              {t('files.explorer')}
            </MenuItem>
          </MenuItemLink>
          <MenuItemLink to="/files/packages">
            <MenuItem className={isRoute('/files/packages')}>
              <Package size={18} />
              {t('files.packages')}
            </MenuItem>
          </MenuItemLink>
          <MenuItemLink to="/files/documents">
            <MenuItem className={isRoute('/files/documents')}>
              <FileText size={18} />
              {t('files.documents')}
            </MenuItem>
          </MenuItemLink>
        </FilesMenu>
        <FilesContent>
          <Routes>
            <Route path="explorer/*" element={<FileExplorer />} />
            <Route path="packages" element={<PackageList />} />
            <Route path="documents" element={<DocumentList />} />
            <Route index element={<Navigate to="explorer" replace />} />
          </Routes>
        </FilesContent>
      </ContentContainer>
    </Container>
  )
}

// Styled components would be defined here

export default Files
```

### IPC Handlers Implementation

```typescript
// src/main/ipc/packageHandlers.ts
import { ipcMain } from 'electron'
import { PackageService } from '../services/PackageService'

const packageService = new PackageService()

export function registerPackageHandlers() {
  ipcMain.handle('package:getAll', async (_, args) => {
    const { filters, sortBy, sortOrder } = args
    return packageService.getPackages(filters, sortBy, sortOrder)
  })

  ipcMain.handle('package:getById', async (_, id) => {
    return packageService.getPackageById(id)
  })

  ipcMain.handle('package:updateMetadata', async (_, args) => {
    const { id, metadata } = args
    return packageService.updatePackageMetadata(id, metadata)
  })

  ipcMain.handle('package:delete', async (_, id) => {
    return packageService.deletePackage(id)
  })

  ipcMain.handle('package:openLocation', async (_, id) => {
    const pkg = await packageService.getPackageById(id)
    if (!pkg) return false

    const fileSystemService = new FileSystemService()
    return fileSystemService.openPackageLocation(pkg.path)
  })

  ipcMain.handle('package:uploadToFTP', async (_, args) => {
    const { id, ftpConfig } = args
    return packageService.uploadPackageToFTP(id, ftpConfig)
  })

  ipcMain.handle('package:uploadToHTTP', async (_, args) => {
    const { id, httpConfig } = args
    return packageService.uploadPackageToHTTP(id, httpConfig)
  })

  ipcMain.handle('package:scan', async (_, directory) => {
    return packageService.scanForPackages(directory)
  })
}
```

## Testing Plan

### Unit Tests

```typescript
// tests/unit/services/PackageService.test.ts
import { PackageService } from '../../../src/main/services/PackageService'
import Package from '../../../src/main/database/models/package'
import { FileSystemService } from '../../../src/main/services/FileSystemService'

// Mock dependencies
jest.mock('../../../src/main/database/models/package')
jest.mock('../../../src/main/services/FileSystemService')

describe('PackageService', () => {
  let packageService: PackageService

  beforeEach(() => {
    jest.clearAllMocks()
    packageService = new PackageService()
  })

  describe('getPackages', () => {
    it('should return packages with default sorting', async () => {
      // Test implementation
    })

    it('should apply filters correctly', async () => {
      // Test implementation
    })

    it('should sort by specified field and order', async () => {
      // Test implementation
    })
  })

  // Additional test cases for other methods
})
```

### Integration Tests

```typescript
// tests/integration/package-management.test.ts
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { PackageService } from '../../src/main/services/PackageService'
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database'

describe('Package Management Integration', () => {
  let packageService: PackageService
  let testDir: string

  beforeAll(async () => {
    await setupTestDatabase()
    testDir = path.join(app.getPath('temp'), 'cherry-studio-test-packages')
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await fs.rm(testDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    packageService = new PackageService()
  })

  it('should detect and index TGZ packages', async () => {
    // Create test TGZ files
    // Run package scanning
    // Verify database entries
  })

  it('should delete package from both filesystem and database', async () => {
    // Create test package
    // Delete package
    // Verify file and database entry are removed
  })

  // Additional integration tests
})
```

## Deployment and Release Plan

1. **Feature Branch Development**
   - Create feature branch `feature/tgz-package-management`
   - Implement according to phases outlined above
   - Regular commits with descriptive messages

2. **Code Review Process**
   - Pull request creation with detailed description
   - Code review by at least two team members
   - Address feedback and make necessary changes

3. **Testing and QA**
   - Run automated tests (unit, integration, E2E)
   - Manual testing of all features
   - Bug fixing and refinement

4. **Documentation**
   - Update user documentation
   - Add developer documentation
   - Create release notes

5. **Merge and Release**
   - Merge feature branch to development branch
   - Include in next release cycle
   - Monitor for any issues after deployment

## Conclusion

This implementation plan provides a detailed roadmap for developing the TGZ Package Management feature in Cherry Studio. By following the phased approach and focusing on incremental development, we can deliver a robust and user-friendly package management solution that integrates seamlessly with the existing application.

The plan includes all necessary technical details, from database schema to UI components, and outlines a comprehensive testing strategy to ensure the feature meets quality standards. The modular architecture allows for future extensions and enhancements as user needs evolve.
