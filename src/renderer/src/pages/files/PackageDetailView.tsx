import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Button, Card, Descriptions, Flex, Form, Input, message, Popconfirm, Select, Switch, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { Package as PackageIcon } from 'lucide-react'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { usePackages } from '../../hooks/usePackages'
import { HTTPConfig, Package, PackageMetadata, PackageType } from '../../types/package'
import { formatFileSize } from '../../utils'

interface PackageDetailViewProps {
  package: Package
  onClose: () => void
  onPackageUpdated?: (updatedPackage: Package) => void
}

const PackageDetailView: FC<PackageDetailViewProps> = ({ package: pkg, onClose, onPackageUpdated }) => {
  const { t } = useTranslation()
  const { updatePackageMetadata, deletePackage, openPackageLocation, uploadToFTP, uploadToHTTP } = usePackages()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // Initialize form with current metadata
  const initializeForm = () => {
    form.setFieldsValue({
      isPatch: pkg.metadata.isPatch,
      components: pkg.metadata.components,
      description: pkg.metadata.description,
      tags: pkg.metadata.tags,
      customFields: pkg.metadata.customFields
    })
  }

  // Handle metadata editing
  const handleEdit = () => {
    setIsEditing(true)
    initializeForm()
  }

  // Handle save metadata
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const updatedMetadata: PackageMetadata = {
        isPatch: values.isPatch || false,
        components: values.components || [],
        description: values.description || '',
        tags: values.tags || [],
        customFields: values.customFields || {}
      }

      const success = await updatePackageMetadata(pkg.id, updatedMetadata)
      if (success) {
        message.success(t('files.package.metadata_updated'))
        setIsEditing(false)
        // Update the package object with new metadata
        const updatedPackage = { ...pkg, metadata: updatedMetadata }
        onPackageUpdated?.(updatedPackage)
      } else {
        message.error(t('files.package.metadata_update_failed'))
      }
    } catch (error) {
      console.error('Error saving metadata:', error)
      message.error(t('files.package.metadata_update_failed'))
    } finally {
      setLoading(false)
    }
  }

  // Handle cancel editing
  const handleCancel = () => {
    setIsEditing(false)
    form.resetFields()
  }

  // Handle package deletion
  const handleDelete = async () => {
    setLoading(true)
    try {
      const success = await deletePackage(pkg.id)
      if (success) {
        message.success(t('files.package.deleted'))
        onClose()
      } else {
        message.error(t('files.package.delete_failed'))
      }
    } catch (error) {
      console.error('Error deleting package:', error)
      message.error(t('files.package.delete_failed'))
    } finally {
      setLoading(false)
    }
  }

  // Handle opening package location
  const handleOpenLocation = async () => {
    await openPackageLocation(pkg.path)
  }

  // Handle upload to device (FTP)
  const handleUploadToDevice = async () => {
    // Hardcoded FTP configuration
    const ftpConfig = {
      host: '172.16.9.224',
      port: 10002,
      username: 'anonymous',
      password: 'anonymous',
      remotePath: '/firmware'
    }

    try {
      setLoading(true)
      const success = await uploadToFTP(pkg.id, ftpConfig)
      if (success) {
        message.success(t('files.package.upload_success'))
        console.log('Package uploaded successfully to FTP:', pkg.name)
      } else {
        message.error(t('files.package.upload_failed'))
        console.error('Failed to upload package to FTP:', pkg.name)
      }
    } catch (error) {
      message.error(t('files.package.upload_failed'))
      console.error('Error uploading package to FTP:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle upload to server (HTTP)
  const handleUploadToServer = async () => {
    try {
      setLoading(true)

      // Default HTTP configuration for package-server
      const defaultHttpConfig: HTTPConfig = {
        url: 'http://172.16.9.224:8083/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }

      const success = await uploadToHTTP(pkg.id, defaultHttpConfig)
      if (success) {
        message.success(t('files.package.upload_success'))
        console.log('Package uploaded successfully to HTTP server:', pkg.name)
      } else {
        message.error(t('files.package.upload_failed'))
        console.error('Failed to upload package to HTTP server:', pkg.name)
      }
    } catch (error) {
      message.error(t('files.package.upload_failed'))
      console.error('Error uploading package to HTTP server:', error)
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <Container>
      <Header>
        <Flex align="center" gap={12}>
          <PackageIcon size={24} />
          <div>
            <Title>{pkg.name}</Title>
            <Subtitle>{pkg.path}</Subtitle>
          </div>
        </Flex>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </Header>

      <Content>
        {/* General Information */}
        <Card title={t('files.package.general_info')} style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label={t('files.name')}>{pkg.name}</Descriptions.Item>
            <Descriptions.Item label={t('files.package_type')}>
              <Tag color={getPackageTypeColor(pkg.packageType)}>{pkg.packageType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('files.version')}>{pkg.version}</Descriptions.Item>
            <Descriptions.Item label={t('files.size')}>{formatFileSize(pkg.size)}</Descriptions.Item>
            <Descriptions.Item label={t('files.created_at')}>
              {dayjs(pkg.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('files.path')} span={2}>
              <Tooltip title={t('files.open_location')}>
                <Button type="link" size="small" onClick={handleOpenLocation} style={{ padding: 0 }}>
                  {pkg.path}
                </Button>
              </Tooltip>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Package Metadata */}
        <Card
          title={t('files.package.metadata')}
          extra={
            !isEditing ? (
              <Button type="text" icon={<EditOutlined />} onClick={handleEdit}>
                {t('common.edit')}
              </Button>
            ) : (
              <Flex gap={8}>
                <Button size="small" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
                <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                  {t('common.save')}
                </Button>
              </Flex>
            )
          }
          style={{ marginBottom: 16 }}>
          {!isEditing ? (
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('files.patch')}>
                {pkg.metadata.isPatch ? (
                  <Tag color="red">{t('files.patch')}</Tag>
                ) : (
                  <Tag color="green">{t('files.full')}</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('files.package.components')}>
                {pkg.metadata.components.length > 0 ? (
                  <Flex gap={4} wrap="wrap">
                    {pkg.metadata.components.map((component, index) => (
                      <Tag key={index}>{component}</Tag>
                    ))}
                  </Flex>
                ) : (
                  <span style={{ color: 'var(--color-text-secondary)' }}>{t('files.package.no_components')}</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('files.package.description')}>
                {pkg.metadata.description || (
                  <span style={{ color: 'var(--color-text-secondary)' }}>{t('files.package.no_description')}</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('files.package.tags')}>
                {pkg.metadata.tags.length > 0 ? (
                  <Flex gap={4} wrap="wrap">
                    {pkg.metadata.tags.map((tag, index) => (
                      <Tag key={index} color="blue">
                        {tag}
                      </Tag>
                    ))}
                  </Flex>
                ) : (
                  <span style={{ color: 'var(--color-text-secondary)' }}>{t('files.package.no_tags')}</span>
                )}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Form form={form} layout="vertical">
              <Form.Item name="isPatch" label={t('files.patch')} valuePropName="checked">
                <Switch checkedChildren={t('files.patch')} unCheckedChildren={t('files.full')} />
              </Form.Item>
              <Form.Item name="components" label={t('files.package.components')}>
                <Select mode="tags" placeholder={t('files.package.components_placeholder')} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="description" label={t('files.package.description')}>
                <Input.TextArea
                  placeholder={t('files.package.description_placeholder')}
                  rows={3}
                  maxLength={500}
                  showCount
                />
              </Form.Item>
              <Form.Item name="tags" label={t('files.package.tags')}>
                <Select mode="tags" placeholder={t('files.package.tags_placeholder')} style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          )}
        </Card>

        {/* Actions */}
        <Card title={t('common.actions')}>
          <Flex gap={12} wrap="wrap">
            <Button icon={<FolderOpenOutlined />} onClick={handleOpenLocation}>
              {t('files.open_location')}
            </Button>
            <Button icon={<UploadOutlined />} onClick={handleUploadToDevice} loading={loading}>
              {t('files.package.upload_to_device')}
            </Button>
            <Button icon={<UploadOutlined />} onClick={handleUploadToServer}>
              {t('files.package.upload_to_server')}
            </Button>
            <Popconfirm
              title={t('files.delete.title')}
              description={t('files.delete.content')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={handleDelete}
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}>
              <Button danger icon={<DeleteOutlined />} loading={loading}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          </Flex>
        </Card>
      </Content>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-background);
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 0.5px solid var(--color-border);
  background-color: var(--color-background);
`

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
`

const Subtitle = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
`

const Content = styled.div`
  flex: 1;
  padding: 24px;
  overflow-y: auto;
`

export default PackageDetailView
