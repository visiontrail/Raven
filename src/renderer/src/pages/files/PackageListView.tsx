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
import { Package, PackageType } from '../../types/package'
import { formatFileSize } from '../../utils'
import PackageDetailView from './PackageDetailView'

interface PackageListViewProps {
  sortField?: 'created_at' | 'size' | 'name' | 'package_type'
  sortOrder?: 'asc' | 'desc'
}

const PackageListView: FC<PackageListViewProps> = ({ sortField = 'created_at', sortOrder = 'desc' }) => {
  const { t } = useTranslation()
  const { packages, loading, error, deletePackage, scanForPackages, openPackageLocation } = usePackages()
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)

  // Sort packages based on sortField and sortOrder
  const sortedPackages = useMemo(() => {
    if (!packages) return []

    return [...packages].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
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

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [packages, sortField, sortOrder])

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
      console.error('Failed to delete package')
    }
  }

  // Handle opening package location
  const handleOpenLocation = async (pkg: Package) => {
    await openPackageLocation(pkg.path)
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
            <span style={{ cursor: 'pointer' }} onClick={() => handleOpenLocation(record)}>
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
      title: t('common.actions'),
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
              onClick={() => {
                // TODO: Implement upload functionality
                console.log('Upload package:', record.id)
              }}
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
      <HeaderContainer>
        <Flex justify="space-between" align="center">
          <span>
            {t('files.packages')} ({sortedPackages.length})
          </span>
          <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            {t('common.refresh')}
          </Button>
        </Flex>
      </HeaderContainer>

      {sortedPackages.length > 0 ? (
        <Table
          columns={columns}
          dataSource={sortedPackages}
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
