import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingDivider, SettingRow, SettingRowTitle } from '..'

const NotionSettings: React.FC = () => {
  const { t } = useTranslation()

  return (
    <>
      <SettingDivider />
      <SettingRow>
        <SettingRowTitle>{t('settings.data.notion.title')}</SettingRowTitle>
        {/* TODO: Implement Notion integration settings */}
        <div>Coming soon...</div>
      </SettingRow>
    </>
  )
}

export default NotionSettings
