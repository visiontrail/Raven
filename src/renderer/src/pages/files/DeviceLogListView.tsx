import {
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Button, Empty, Flex, message, Popconfirm, Table, Tag, Tooltip } from 'antd'
import { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { FileText } from 'lucide-react'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import FtpService from '../../services/FtpService'
import { formatFileSize } from '../../utils'

// 设备日志文件接口
interface DeviceLogFile {
  id: string
  name: string
  size: number
  modifiedTime: Date
  type: 'protocol' | 'oam_antenna' // 协议栈日志 | OAM与天线日志
  path: string
}

// FTP配置
const FTP_CONFIG = {
  host: '172.16.9.224',
  port: 10002,
  username: 'anonymous',
  password: 'anonymous',
  remotePath: '/logs'
}

// 日志服务器配置
const LOG_SERVER_URL = 'http://172.16.9.224:8085/upload'

interface DeviceLogListViewProps {}

const DeviceLogListView: FC<DeviceLogListViewProps> = () => {
  const { t } = useTranslation()
  const [files, setFiles] = useState<DeviceLogFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [uploadingFileIds, setUploadingFileIds] = useState<Set<string>>(new Set())
  const [downloadingFileIds, setDownloadingFileIds] = useState<Set<string>>(new Set())

  // 根据文件名判断日志类型
  const getLogType = useCallback((fileName: string): 'protocol' | 'oam_antenna' => {
    const lowerName = fileName.toLowerCase()
    if (lowerName.includes('protocol') || lowerName.includes('协议栈')) {
      return 'protocol'
    }
    return 'oam_antenna'
  }, [])

  // 获取日志类型标签颜色
  const getLogTypeColor = (type: 'protocol' | 'oam_antenna'): string => {
    switch (type) {
      case 'protocol':
        return 'blue'
      case 'oam_antenna':
        return 'green'
      default:
        return 'default'
    }
  }

  // 获取日志类型标签文本
  const getLogTypeText = (type: 'protocol' | 'oam_antenna'): string => {
    switch (type) {
      case 'protocol':
        return '协议栈日志'
      case 'oam_antenna':
        return 'OAM与天线日志'
      default:
        return '未知类型'
    }
  }

  // FTP连接和获取文件列表
  const fetchFileList = useCallback(async () => {
    console.log('[DeviceLogListView] 开始获取文件列表...')
    setLoading(true)
    try {
      console.log('[DeviceLogListView] FTP配置:', FTP_CONFIG)
      const ftpService = new FtpService(FTP_CONFIG)
      console.log('[DeviceLogListView] 调用FTP服务listFiles...')
      const ftpFiles = await ftpService.listFiles()
      console.log('[DeviceLogListView] FTP返回的文件列表:', ftpFiles)

      // 转换为DeviceLogFile格式
      const deviceLogFiles: DeviceLogFile[] = ftpFiles.map((file, index) => {
        const deviceFile = {
          id: `${index + 1}`,
          name: file.name,
          size: file.size,
          modifiedTime: file.modifiedTime,
          type: getLogType(file.name),
          path: file.path
        }
        console.log('[DeviceLogListView] 转换文件:', file, '->', deviceFile)
        return deviceFile
      })

      console.log('[DeviceLogListView] 最终设备日志文件列表:', deviceLogFiles)
      setFiles(deviceLogFiles)
      message.success(`设备日志列表刷新成功，共 ${deviceLogFiles.length} 个文件`)
    } catch (error) {
      console.error('[DeviceLogListView] 获取设备日志列表失败:', error)
      message.error(`获取设备日志列表失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [getLogType])

  // 删除日志文件
  const handleDelete = async (file: DeviceLogFile) => {
    try {
      const ftpService = new FtpService(FTP_CONFIG)
      await ftpService.deleteFile(file.path)

      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      message.success(`删除日志文件 ${file.name} 成功`)
    } catch (error) {
      console.error('删除日志文件失败:', error)
      message.error('删除日志文件失败')
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文件')
      return
    }

    try {
      const selectedFiles = files.filter((f) => selectedRowKeys.includes(f.id))
      const remotePaths = selectedFiles.map((f) => f.path)

      const ftpService = new FtpService(FTP_CONFIG)
      await ftpService.deleteFiles(remotePaths)

      setFiles((prev) => prev.filter((f) => !selectedRowKeys.includes(f.id)))
      setSelectedRowKeys([])
      message.success(`批量删除 ${selectedRowKeys.length} 个文件成功`)
    } catch (error) {
      console.error('批量删除失败:', error)
      message.error('批量删除失败')
    }
  }

  // 上传并处理日志文件
  const handleUploadAndProcess = async (file: DeviceLogFile) => {
    setUploadingFileIds((prev) => new Set(prev).add(file.id))

    try {
      const ftpService = new FtpService(FTP_CONFIG)

      // 1. 从FTP下载文件到本地临时目录
      message.info(`正在从FTP下载 ${file.name}...`)
      const tempDir = await window.api.file.createTempFile('device_logs')
      const localPath = `${tempDir}/${file.name}`
      await ftpService.downloadFile(file.path, localPath)

      // 2. 上传到日志服务器
      message.info(`正在上传 ${file.name} 到日志服务器...`)
      const formData = new FormData()
      const fileBlob = await fetch(`file://${localPath}`).then((r) => r.blob())
      formData.append('file', fileBlob, file.name)

      const response = await fetch(LOG_SERVER_URL, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`上传失败: ${response.statusText}`)
      }

      // 3. 删除本地临时文件
      message.info(`正在清理本地临时文件...`)
      await window.api.file.delete(localPath)

      message.success(`${file.name} 处理完成`)
    } catch (error) {
      console.error('上传并处理日志文件失败:', error)
      message.error('上传并处理日志文件失败')
    } finally {
      setUploadingFileIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  // 直接下载文件
  const handleDirectDownload = async (file: DeviceLogFile) => {
    setDownloadingFileIds((prev) => new Set(prev).add(file.id))

    try {
      // 弹出文件选择器
      const result = await window.api.file.save('', '', {
        defaultPath: file.name,
        filters: [
          { name: 'Tar.gz Files', extensions: ['tar.gz'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return
      }

      // 从FTP下载文件
      message.info(`正在下载 ${file.name}...`)
      const ftpService = new FtpService(FTP_CONFIG)
      await ftpService.downloadFile(file.path, result.filePath)

      message.success(`${file.name} 下载完成`)
    } catch (error) {
      console.error('下载文件失败:', error)
      message.error('下载文件失败')
    } finally {
      setDownloadingFileIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  // 批量上传并处理
  const handleBatchUploadAndProcess = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要处理的文件')
      return
    }

    const selectedFiles = files.filter((f) => selectedRowKeys.includes(f.id))

    for (const file of selectedFiles) {
      await handleUploadAndProcess(file)
    }

    setSelectedRowKeys([])
  }

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要下载的文件')
      return
    }

    const selectedFiles = files.filter((f) => selectedRowKeys.includes(f.id))

    for (const file of selectedFiles) {
      await handleDirectDownload(file)
    }

    setSelectedRowKeys([])
  }

  // 组件挂载时获取文件列表
  useEffect(() => {
    fetchFileList()
  }, [])

  // 表格列配置
  const columns: ColumnsType<DeviceLogFile> = [
    {
      title: t('files.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DeviceLogFile) => (
        <Flex align="center" gap={8}>
          <FileText size={16} />
          <Tooltip title={record.path}>
            <span>{name}</span>
          </Tooltip>
        </Flex>
      )
    },
    {
      title: '日志类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: 'protocol' | 'oam_antenna') => <Tag color={getLogTypeColor(type)}>{getLogTypeText(type)}</Tag>
    },
    {
      title: t('files.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size)
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      render: (modifiedTime: Date) => dayjs(modifiedTime).format('MM-DD HH:mm')
    },
    {
      title: t('files.actions'),
      key: 'actions',
      render: (_, record: DeviceLogFile) => (
        <Flex align="center" gap={4}>
          <Tooltip title="上传并处理">
            <Button
              type="text"
              size="small"
              icon={<UploadOutlined />}
              loading={uploadingFileIds.has(record.id)}
              onClick={() => handleUploadAndProcess(record)}
            />
          </Tooltip>
          <Tooltip title="直接下载">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingFileIds.has(record.id)}
              onClick={() => handleDirectDownload(record)}
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

  return (
    <Container>
      <HeaderContainer>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={8}>
            <FileText size={16} />
            <span>设备日志 ({files.length})</span>
          </Flex>
          <Flex gap={8}>
            {selectedRowKeys.length > 0 && (
              <>
                <Button type="primary" size="small" icon={<UploadOutlined />} onClick={handleBatchUploadAndProcess}>
                  批量处理 ({selectedRowKeys.length})
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleBatchDownload}>
                  批量下载 ({selectedRowKeys.length})
                </Button>
                <Popconfirm
                  title="确认批量删除"
                  description={`确定要删除选中的 ${selectedRowKeys.length} 个文件吗？`}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  onConfirm={handleBatchDelete}
                  icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}>
                  <Button danger size="small" icon={<DeleteOutlined />}>
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button type="text" icon={<ReloadOutlined />} onClick={fetchFileList} loading={loading}>
              {t('common.refresh')}
            </Button>
          </Flex>
        </Flex>
      </HeaderContainer>

      {files.length > 0 ? (
        <Table
          columns={columns}
          dataSource={files}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} files`
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (selectedRowKeys: React.Key[]) => setSelectedRowKeys(selectedRowKeys as string[]),
            type: 'checkbox'
          }}
          size="small"
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备日志文件" style={{ marginTop: 40 }}>
          <Button onClick={fetchFileList} icon={<ReloadOutlined />}>
            刷新列表
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

export default DeviceLogListView
