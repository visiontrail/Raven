import { ReloadOutlined } from '@ant-design/icons'
import { Button, Flex, Spin } from 'antd'
import { FileText } from 'lucide-react'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface LogListViewProps {}

const LogListView: FC<LogListViewProps> = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const logUrl = 'http://172.16.9.224:8085/'

  const handleReload = () => {
    setLoading(true)
    setError(false)
    // Force iframe reload by updating the key
    const iframe = document.getElementById('log-iframe') as HTMLIFrameElement
    if (iframe) {
      iframe.src = iframe.src
    }
  }

  const handleIframeLoad = () => {
    setLoading(false)
    setError(false)
  }

  const handleIframeError = () => {
    setLoading(false)
    setError(true)
  }

  return (
    <Container>
      <HeaderContainer>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={8}>
            <FileText size={16} />
            <span>{t('files.logs')}</span>
          </Flex>
          <Button type="text" icon={<ReloadOutlined />} onClick={handleReload} loading={loading}>
            {t('common.refresh')}
          </Button>
        </Flex>
      </HeaderContainer>

      <IframeContainer>
        {loading && (
          <LoadingContainer>
            <Spin size="large" />
            <span>{t('files.loading_logs')}</span>
          </LoadingContainer>
        )}
        {error && (
          <ErrorContainer>
            <p>{t('files.error_loading_logs')}</p>
            <Button onClick={handleReload} icon={<ReloadOutlined />}>
              {t('common.retry')}
            </Button>
          </ErrorContainer>
        )}
        <StyledIframe
          id="log-iframe"
          src={logUrl}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{ display: loading || error ? 'none' : 'block' }}
        />
      </IframeContainer>
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

const IframeContainer = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`

const StyledIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  background-color: var(--color-background);
`

const LoadingContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--color-text-secondary);
`

const ErrorContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--color-text-secondary);
`

export default LogListView