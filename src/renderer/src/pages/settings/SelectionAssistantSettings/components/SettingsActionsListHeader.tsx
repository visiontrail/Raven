import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Text } = Typography

interface SettingsActionsListHeaderProps {
  onAddAction: () => void
  onAdd: () => void
  onReset: () => void
  canAddMore: boolean
  customItemsCount: number
  maxCustomItems: number
}

const SettingsActionsListHeader: FC<SettingsActionsListHeaderProps> = ({
  onAddAction,
  onAdd,
  onReset,
  canAddMore,
  customItemsCount,
  maxCustomItems
}) => {
  const { t } = useTranslation()

  return (
    <Container>
      <HeaderContent>
        <TitleSection>
          <Title level={4} style={{ margin: 0 }}>
            {t('selection.settings.actions.title')}
          </Title>
          <Description>{t('selection.settings.actions.description')}</Description>
        </TitleSection>

        <ButtonSection>
          <Space>
            <Button type="default" icon={<PlusOutlined />} onClick={onAdd || onAddAction} disabled={!canAddMore}>
              {t('selection.settings.actions.add')}
            </Button>
            <Button type="default" icon={<ReloadOutlined />} onClick={onReset}>
              {t('selection.settings.actions.reset.button')}
            </Button>
          </Space>
        </ButtonSection>
      </HeaderContent>

      <InfoSection>
        <InfoItem>
          <InfoLabel>{t('selection.settings.actions.custom_count')}:</InfoLabel>
          <InfoValue>
            {customItemsCount}/{maxCustomItems}
          </InfoValue>
        </InfoItem>

        {!canAddMore && <WarningText>{t('selection.settings.actions.max_custom_reached')}</WarningText>}
      </InfoSection>
    </Container>
  )
}

const Container = styled.div`
  margin-bottom: 24px;
`

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`

const TitleSection = styled.div`
  flex: 1;
`

const Description = styled(Text)`
  color: var(--color-text-3);
  font-size: 14px;
  display: block;
  margin-top: 4px;
`

const ButtonSection = styled.div`
  flex-shrink: 0;
`

const InfoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background-color: var(--color-fill-1);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const InfoLabel = styled.span`
  font-size: 13px;
  color: var(--color-text-2);
`

const InfoValue = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
`

const WarningText = styled(Text)`
  color: var(--color-warning);
  font-size: 13px;
`

export default SettingsActionsListHeader
