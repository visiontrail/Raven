import { HStack } from '@renderer/components/Layout'
import { isFeatureDisabled, isLockedModeEnabled, LOCKED_SETTINGS } from '@renderer/config/locked-settings'
import { PROVIDER_CONFIG } from '@renderer/config/providers'
import { useVertexAISettings } from '@renderer/hooks/useVertexAI'
import { Alert, Input } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingHelpLink, SettingHelpText, SettingHelpTextRow, SettingSubtitle } from '..'

const VertexAISettings: FC = () => {
  const { t } = useTranslation()
  const {
    projectId,
    location,
    serviceAccount,
    setProjectId,
    setLocation,
    setServiceAccountPrivateKey,
    setServiceAccountClientEmail
  } = useVertexAISettings()

  const isLocked = isLockedModeEnabled()
  const lockedSettings = LOCKED_SETTINGS.VERTEX_AI_SERVICE_ACCOUNT
  const lockedProjectId = LOCKED_SETTINGS.VERTEX_AI_PROJECT_ID
  const lockedLocation = LOCKED_SETTINGS.VERTEX_AI_LOCATION

  const providerConfig = PROVIDER_CONFIG['vertexai']
  const apiKeyWebsite = providerConfig?.websites?.apiKey

  const [localProjectId, setLocalProjectId] = useState(isLocked ? lockedProjectId : projectId)
  const [localLocation, setLocalLocation] = useState(isLocked ? lockedLocation : location)

  // 在锁定模式下自动应用设置
  useEffect(() => {
    if (isLocked) {
      if (lockedProjectId && projectId !== lockedProjectId) {
        setProjectId(lockedProjectId)
      }
      if (lockedLocation && location !== lockedLocation) {
        setLocation(lockedLocation)
      }
      if (lockedSettings.clientEmail && serviceAccount.clientEmail !== lockedSettings.clientEmail) {
        setServiceAccountClientEmail(lockedSettings.clientEmail)
      }
      if (lockedSettings.privateKey && serviceAccount.privateKey !== lockedSettings.privateKey) {
        setServiceAccountPrivateKey(lockedSettings.privateKey)
      }
    }
  }, [
    isLocked,
    lockedProjectId,
    lockedLocation,
    lockedSettings,
    projectId,
    location,
    serviceAccount,
    setProjectId,
    setLocation,
    setServiceAccountClientEmail,
    setServiceAccountPrivateKey
  ])

  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLocked) {
      setLocalProjectId(e.target.value)
    }
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLocked) {
      const newLocation = e.target.value
      setLocalLocation(newLocation)
    }
  }

  const handleServiceAccountPrivateKeyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isLocked) {
      setServiceAccountPrivateKey(e.target.value)
    }
  }

  const handleServiceAccountPrivateKeyBlur = () => {
    if (!isLocked) {
      setServiceAccountPrivateKey(serviceAccount.privateKey)
    }
  }

  const handleServiceAccountClientEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLocked) {
      setServiceAccountClientEmail(e.target.value)
    }
  }

  const handleServiceAccountClientEmailBlur = () => {
    if (!isLocked) {
      setServiceAccountClientEmail(serviceAccount.clientEmail)
    }
  }

  const handleProjectIdBlur = () => {
    if (!isLocked) {
      setProjectId(localProjectId)
    }
  }

  const handleLocationBlur = () => {
    if (!isLocked) {
      setLocation(localLocation)
    }
  }

  return (
    <>
      <SettingSubtitle style={{ marginTop: 5 }}>
        {t('settings.provider.vertex_ai.service_account.title')}
      </SettingSubtitle>
      <Alert
        type="info"
        style={{ marginTop: 5 }}
        message={t('settings.provider.vertex_ai.service_account.description')}
        showIcon
      />

      <SettingSubtitle style={{ marginTop: 5 }}>
        {t('settings.provider.vertex_ai.service_account.client_email')}
      </SettingSubtitle>
      <Input.Password
        value={isLocked ? lockedSettings.clientEmail : serviceAccount.clientEmail}
        placeholder={
          isLocked
            ? t('settings.provider.locked_value')
            : t('settings.provider.vertex_ai.service_account.client_email_placeholder')
        }
        onChange={handleServiceAccountClientEmailChange}
        onBlur={handleServiceAccountClientEmailBlur}
        style={{ marginTop: 5 }}
        disabled={isLocked || isFeatureDisabled('DISABLE_API_KEY_EDITING')}
      />
      <SettingHelpTextRow>
        <SettingHelpText>{t('settings.provider.vertex_ai.service_account.client_email_help')}</SettingHelpText>
      </SettingHelpTextRow>

      <SettingSubtitle style={{ marginTop: 5 }}>
        {t('settings.provider.vertex_ai.service_account.private_key')}
      </SettingSubtitle>
      <Input.TextArea
        value={isLocked ? lockedSettings.privateKey : serviceAccount.privateKey}
        placeholder={
          isLocked
            ? t('settings.provider.locked_value')
            : t('settings.provider.vertex_ai.service_account.private_key_placeholder')
        }
        onChange={handleServiceAccountPrivateKeyChange}
        onBlur={handleServiceAccountPrivateKeyBlur}
        style={{ marginTop: 5 }}
        spellCheck={false}
        autoSize={{ minRows: 4, maxRows: 4 }}
        disabled={isLocked || isFeatureDisabled('DISABLE_API_KEY_EDITING')}
      />
      {apiKeyWebsite && (
        <SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
          <HStack>
            <SettingHelpLink target="_blank" href={apiKeyWebsite}>
              {t('settings.provider.get_api_key')}
            </SettingHelpLink>
          </HStack>
          <SettingHelpText>{t('settings.provider.vertex_ai.service_account.private_key_help')}</SettingHelpText>
        </SettingHelpTextRow>
      )}
      <>
        <SettingSubtitle style={{ marginTop: 5 }}>{t('settings.provider.vertex_ai.project_id')}</SettingSubtitle>
        <Input.Password
          value={isLocked ? lockedProjectId : localProjectId}
          placeholder={
            isLocked ? t('settings.provider.locked_value') : t('settings.provider.vertex_ai.project_id_placeholder')
          }
          onChange={handleProjectIdChange}
          onBlur={handleProjectIdBlur}
          style={{ marginTop: 5 }}
          disabled={isLocked || isFeatureDisabled('DISABLE_API_KEY_EDITING')}
        />
        <SettingHelpTextRow>
          <SettingHelpText>{t('settings.provider.vertex_ai.project_id_help')}</SettingHelpText>
        </SettingHelpTextRow>

        <SettingSubtitle style={{ marginTop: 5 }}>{t('settings.provider.vertex_ai.location')}</SettingSubtitle>
        <Input
          value={isLocked ? lockedLocation : localLocation}
          placeholder={isLocked ? t('settings.provider.locked_value') : 'us-central1'}
          onChange={handleLocationChange}
          onBlur={handleLocationBlur}
          style={{ marginTop: 5 }}
          disabled={isLocked || isFeatureDisabled('DISABLE_API_KEY_EDITING')}
        />
        <SettingHelpTextRow>
          <SettingHelpText>{t('settings.provider.vertex_ai.location_help')}</SettingHelpText>
        </SettingHelpTextRow>
      </>
    </>
  )
}

export default VertexAISettings
