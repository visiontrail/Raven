import { Modal, Progress, Typography } from 'antd'
import { FC } from 'react'
import styled from 'styled-components'

import { formatFileSize } from '../../utils'

const { Text } = Typography

export interface DownloadProgressDialogProps {
  visible: boolean
  fileName: string
  progress: {
    bytesTransferred: number
    totalBytes: number
    percentage: number
  }
  onCancel?: () => void
}

const DownloadProgressDialog: FC<DownloadProgressDialogProps> = ({
  visible,
  fileName,
  progress,
  onCancel
}) => {
  return (
    <Modal
      title="文件下载进度"
      open={visible}
      footer={null}
      onCancel={onCancel}
      closable={false}
      maskClosable={false}
      width={400}
      centered
    >
      <ProgressContainer>
        <FileNameContainer>
          <Text strong>{fileName}</Text>
        </FileNameContainer>
        
        <Progress
          percent={progress.percentage}
          status="active"
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068'
          }}
          format={(percent) => `${percent}%`}
        />
        
        <ProgressInfo>
          <Text type="secondary">
            {formatFileSize(progress.bytesTransferred)} / {formatFileSize(progress.totalBytes)}
          </Text>
        </ProgressInfo>
      </ProgressContainer>
    </Modal>
  )
}

const ProgressContainer = styled.div`
  padding: 16px 0;
`

const FileNameContainer = styled.div`
  margin-bottom: 16px;
  text-align: center;
  word-break: break-all;
`

const ProgressInfo = styled.div`
  margin-top: 8px;
  text-align: center;
`

export default DownloadProgressDialog