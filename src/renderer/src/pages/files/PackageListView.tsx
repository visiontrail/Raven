import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Button, Empty, Flex, Popconfirm, Table, Tag, Tooltip } from 'antd'
import { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Package as PackageIcon } from 'lucide-react'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { usePackages } from '../../hooks/usePackages'
import { loggerService } from '../../services/LoggerService'
import { Package, PackageType } from '../../types/package'
import { formatFileSize } from '../../utils'
import PackageDetailView from './PackageDetailView'
import PackageFilterBar, { PackageFilters, PackageSorting } from './PackageFilterBar'

interface PackageListViewProps {}

const PackageListView: FC<PackageListViewProps> = () => {
  const { t } = useTranslation()
  const { packages, loading, error, deletePackage, scanForPackages, openPackageLocation, uploadToFTP } = usePackages()
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [uploadingPackageId, setUploadingPackageId] = useState<string | null>(null)

  // State for filters and sorting
  const [filters, setFilters] = useState<PackageFilters>({
    search: '',
    packageType: 'all',
    isPatch: 'all'
  })

  const [sorting, setSorting] = useState<PackageSorting>({
    field: 'created_at',
    order: 'desc'
  })

  // Filter and sort packages based on current filters and sorting
  const filteredAndSortedPackages = useMemo(() => {
    if (!packages) return []

    // First apply filters
    const filtered = packages.filter((pkg) => {
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

    // Then apply sorting
    return filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sorting.field) {
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

      if (aValue < bValue) return sorting.order === 'asc' ? -1 : 1
      if (aValue > bValue) return sorting.order === 'asc' ? 1 : -1
      return 0
    })
  }, [packages, filters, sorting])

  // Get package type color for tags
  const getPackageTypeColor = (packageType: PackageType): string => {
    switch (packageType) {
      case PackageType.LINGXI_10:
        return 'blue'
      case PackageType.LINGXI_07A:
        return 'green'
      case PackageType.CONFIG:
        return 'orange'
      case PackageType.LINGXI_06TRD:
        return 'purple'
      default:
        return 'default'
    }
  }

  // Handle package deletion
  const handleDelete = async (pkg: Package) => {
    const success = await deletePackage(pkg.id)
    if (!success) {
      // TODO: Show error notification
      loggerService.error('Failed to delete package')
    }
  }

  // Handle opening package location
  const handleOpenLocation = async (pkg: Package) => {
    await openPackageLocation(pkg.path)
  }

  // Handle FTP upload
  const handleUploadToFTP = async (pkg: Package) => {
    // Hardcoded FTP configuration
    const ftpConfig = {
      host: '172.16.9.224',
      port: 10002,
      username: 'anonymous',
      password: 'anonymous',
      remotePath: '/firmware'
    }

    try {
      setUploadingPackageId(pkg.id)
      const success = await uploadToFTP(pkg.id, ftpConfig)
      if (success) {
        loggerService.info(`Package uploaded successfully to FTP: ${pkg.name}`)
        // TODO: Show success notification
      } else {
        loggerService.error(`Failed to upload package to FTP: ${pkg.name}`)
        // TODO: Show error notification
      }
    } catch (error) {
      loggerService.error('Error uploading package to FTP:', error as Error)
      // TODO: Show error notification
    } finally {
      setUploadingPackageId(null)
    }
  }

  // Handle refresh/scan for packages
  const handleRefresh = async () => {
    await scanForPackages()
  }

  // Handle viewing package details
  const handleViewDetails = (pkg: Package) => {
    setSelectedPackage(pkg)
  }

  // Handle closing package details
  const handleCloseDetails = () => {
    setSelectedPackage(null)
  }

  // Handle package updated from detail view
  const handlePackageUpdated = (updatedPackage: Package) => {
    // The packages list will be automatically refreshed by the usePackages hook
    setSelectedPackage(updatedPackage)
  }

  // Table columns configuration
  const columns: ColumnsType<Package> = [
    {
      title: t('files.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Package) => (
        <Flex align="center" gap={8}>
          <PackageIcon size={16} />
          <Tooltip title={record.path}>
            <span style={{ cursor: 'pointer' }} onClick={() => handleViewDetails(record)}>
              {name}
            </span>
          </Tooltip>
        </Flex>
      )
    },
    {
      title: t('files.package_type'),
      dataIndex: 'packageType',
      key: 'packageType',
      render: (packageType: PackageType) => <Tag color={getPackageTypeColor(packageType)}>{packageType}</Tag>
    },
    {
      title: t('files.version'),
      dataIndex: 'version',
      key: 'version'
    },
    {
      title: t('files.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size)
    },
    {
      title: t('files.created_at'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: Date) => dayjs(createdAt).format('MM-DD HH:mm')
    },
    {
      title: t('files.patch'),
      dataIndex: 'metadata',
      key: 'isPatch',
      render: (metadata: any) =>
        metadata?.isPatch ? <Tag color="red">{t('files.patch')}</Tag> : <Tag color="green">{t('files.full')}</Tag>
    },
    {
      title: t('files.actions'),
      key: 'actions',
      render: (_, record: Package) => (
        <Flex align="center" gap={4}>
          <Tooltip title={t('files.package.view_details')}>
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)} />
          </Tooltip>
          <Tooltip title={t('files.open_location')}>
            <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={() => handleOpenLocation(record)} />
          </Tooltip>
          <Tooltip title={t('files.upload')}>
            <Button
              type="text"
              size="small"
              icon={<UploadOutlined />}
              loading={uploadingPackageId === record.id}
              onClick={() => handleUploadToFTP(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('files.delete.title')}
            description={t('files.delete.content')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record)}
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}>
            <Tooltip title={t('common.delete')}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Flex>
      )
    }
  ]

  if (error) {
    return (
      <Container>
        <ErrorContainer>
          <p>
            {t('files.error_loading_packages')}: {error}
          </p>
          <Button onClick={handleRefresh} icon={<ReloadOutlined />}>
            {t('common.retry')}
          </Button>
        </ErrorContainer>
      </Container>
    )
  }

  // Show package detail view if a package is selected
  if (selectedPackage) {
    return (
      <PackageDetailView
        package={selectedPackage}
        onClose={handleCloseDetails}
        onPackageUpdated={handlePackageUpdated}
      />
    )
  }

  return (
    <Container>
      <PackageFilterBar
        filters={filters}
        sorting={sorting}
        onFiltersChange={setFilters}
        onSortingChange={setSorting}
        totalCount={filteredAndSortedPackages.length}
      />

      <HeaderContainer>
        <Flex justify="space-between" align="center">
          <span>
            {filteredAndSortedPackages.length > 0 && packages && filteredAndSortedPackages.length !== packages.length
              ? t('files.packages_count', { count: filteredAndSortedPackages.length }) + ` / ${packages.length}`
              : t('files.packages_count', { count: filteredAndSortedPackages.length })}
          </span>
          <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            {t('common.refresh')}
          </Button>
        </Flex>
      </HeaderContainer>

      {filteredAndSortedPackages.length > 0 ? (
        <Table
          columns={columns}
          dataSource={filteredAndSortedPackages}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} packages`
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (selectedRowKeys: React.Key[]) => setSelectedRowKeys(selectedRowKeys as string[]),
            type: 'checkbox'
          }}
          size="small"
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('files.no_packages')} style={{ marginTop: 40 }}>
          <Button onClick={handleRefresh} icon={<ReloadOutlined />}>
            {t('files.scan_packages')}
          </Button>
        </Empty>
      )}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const HeaderContainer = styled.div`
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-border);
  background-color: var(--color-background);
`

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 16px;
  color: var(--color-text-secondary);
`

export default PackageListView
