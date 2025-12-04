import { ReloadOutlined } from '@ant-design/icons'
import { Button, Flex, Spin } from 'antd'
import { FileText } from 'lucide-react'
import { FC, ReactNode, useState } from 'react'
import styled from 'styled-components'

interface ServerIframeViewProps {
  title: ReactNode
  url: string
  iframeId: string
  loadingText: ReactNode
  errorText: ReactNode
  refreshLabel: ReactNode
  retryLabel: ReactNode
  icon?: ReactNode
}

const ServerIframeView: FC<ServerIframeViewProps> = ({
  title,
  url,
  iframeId,
  loadingText,
  errorText,
  refreshLabel,
  retryLabel,
  icon = <FileText size={16} />
}) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleReload = () => {
    setLoading(true)
    setError(false)
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null
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
            {icon}
            <span>{title}</span>
          </Flex>
          <Button type="text" icon={<ReloadOutlined />} onClick={handleReload} loading={loading}>
            {refreshLabel}
          </Button>
        </Flex>
      </HeaderContainer>

      <IframeContainer>
        {loading && (
          <LoadingContainer>
            <Spin size="large" />
            <span>{loadingText}</span>
          </LoadingContainer>
        )}
        {error && (
          <ErrorContainer>
            <p>{errorText}</p>
            <Button onClick={handleReload} icon={<ReloadOutlined />}>
              {retryLabel}
            </Button>
          </ErrorContainer>
        )}
        <StyledIframe
          id={iframeId}
          src={url}
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

export default ServerIframeView
