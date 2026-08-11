import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import { isLocalAi } from '@renderer/config/env'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { getProviderName } from '@renderer/services/ProviderService'
import { Assistant } from '@renderer/types'
import { Button } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  assistant: Assistant
}

const SelectModelButton: FC<Props> = ({ assistant }) => {
  const { model } = useAssistant(assistant.id)
  const { t } = useTranslation()

  if (isLocalAi) {
    return null
  }

  const providerName = getProviderName(model?.provider)

  return (
    <DropdownButton size="small" type="text" disabled>
      <ButtonContent>
        <ModelAvatar model={model} size={20} />
        <ModelName>
          {model ? model.name : t('button.select_model')} {providerName ? ' | ' + providerName : ''}
        </ModelName>
      </ButtonContent>
    </DropdownButton>
  )
}

const DropdownButton = styled(Button)`
  font-size: 11px;
  border-radius: 15px;
  padding: 13px 5px;
  -webkit-app-region: none;
  box-shadow: none;
  background-color: transparent;
  border: 1px solid transparent;
  margin-top: 1px;
`

const ButtonContent = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const ModelName = styled.span`
  font-weight: 500;
  margin-right: -2px;
`

export default SelectModelButton
