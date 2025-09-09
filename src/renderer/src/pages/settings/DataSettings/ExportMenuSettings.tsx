import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingDivider, SettingRow, SettingRowTitle } from '..'

const ExportMenuOptions: React.FC = () => {
  const { t } = useTranslation()

  return (
    <>
      <SettingDivider />
      <SettingRow>
        <SettingRowTitle>{t('settings.data.export_menu.title')}</SettingRowTitle>
        {/* TODO: Implement export menu options */}
        <div>Coming soon...</div>
      </SettingRow>
    </>
  )
}

export default ExportMenuOptions
