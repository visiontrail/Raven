import React from 'react'
import { useTranslation } from 'react-i18next'

import { SettingDivider, SettingRow, SettingRowTitle } from '..'

const JoplinSettings: React.FC = () => {
  const { t } = useTranslation()

  return (
    <>
      <SettingDivider />
      <SettingRow>
        <SettingRowTitle>{t('settings.data.joplin.title')}</SettingRowTitle>
        {/* TODO: Implement Joplin integration settings */}
        <div>Coming soon...</div>
      </SettingRow>
    </>
  )
}

export default JoplinSettings
