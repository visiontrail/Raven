import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingDivider, SettingRow, SettingRowTitle } from '..'

const AgentsSubscribeUrlSettings: React.FC = () => {
  const { t } = useTranslation()

  return (
    <>
      <SettingDivider />
      <SettingRow>
        <SettingRowTitle>{t('settings.data.agents_subscribe_url.title')}</SettingRowTitle>
        {/* TODO: Implement agents subscribe URL settings */}
        <div>Coming soon...</div>
      </SettingRow>
    </>
  )
}

export default AgentsSubscribeUrlSettings