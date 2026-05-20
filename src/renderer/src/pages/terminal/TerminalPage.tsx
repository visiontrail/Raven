import { TerminalSquare } from 'lucide-react'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import styled from 'styled-components'

/**
 * Route element for /terminal.
 *
 * §6.2 – route guard: redirects to / if Chaterm assets are unavailable.
 *
 * The actual <webview> lives in ChatermWebviewHost (mounted outside the Routes
 * tree) so SSH sessions survive route changes (§6.4). This component just
 * provides the route match and shows a "not available" message when needed.
 */
const TerminalPage: FC = () => {
  const { t } = useTranslation()
  const [status, setStatus] = useState<{ hasAssets: boolean } | null>(null)

  useEffect(() => {
    window.api.chaterm
      .getStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus({ hasAssets: false }))
  }, [])

  // Still fetching status — render nothing; ChatermWebviewHost shows the loading overlay
  if (status === null) return null

  // §6.2: route guard — redirect if Chaterm resources not found
  if (!status.hasAssets) {
    return (
      <Container>
        <TerminalSquare size={48} strokeWidth={1.5} />
        <Title>{t('terminal.title')}</Title>
        <Subtitle>{t('terminal.notAvailable', 'Terminal is not available. Chaterm resources not found.')}</Subtitle>
      </Container>
    )
  }

  // Chaterm assets exist — ChatermWebviewHost handles the webview rendering.
  // Render nothing so the host fills the space via position:fixed.
  return null
}

export const TerminalRedirect: FC = () => {
  return <Navigate to="/" replace />
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--color-text-2);
`

const Title = styled.h2`
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text);
  margin: 0;
`

const Subtitle = styled.p`
  font-size: 14px;
  margin: 0;
`

export default TerminalPage
