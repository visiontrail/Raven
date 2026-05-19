import { TerminalSquare } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const TerminalPage: FC = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <TerminalSquare size={48} strokeWidth={1.5} />
      <Title>{t('terminal.title')}</Title>
      <Subtitle>{t('terminal.comingSoon')}</Subtitle>
    </Container>
  )
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
