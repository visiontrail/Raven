import { isFeatureDisabled, isLockedModeEnabled, LOCKED_SETTINGS } from '@renderer/config/locked-settings'
import { useLMStudioSettings } from '@renderer/hooks/useLMStudio'
import { InputNumber } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingHelpText, SettingHelpTextRow, SettingSubtitle } from '..'

const LMStudioSettings: FC = () => {
  const { keepAliveTime, setKeepAliveTime } = useLMStudioSettings()
  const isLocked = isLockedModeEnabled()
  const lockedKeepAlive = LOCKED_SETTINGS.LMSTUDIO_KEEP_ALIVE

  const [keepAliveMinutes, setKeepAliveMinutes] = useState(isLocked ? lockedKeepAlive : keepAliveTime)
  const { t } = useTranslation()

  // 在锁定模式下自动应用设置
  useEffect(() => {
    if (isLocked && lockedKeepAlive && keepAliveTime !== lockedKeepAlive) {
      setKeepAliveTime(lockedKeepAlive)
      setKeepAliveMinutes(lockedKeepAlive)
    }
  }, [isLocked, lockedKeepAlive, keepAliveTime, setKeepAliveTime])

  return (
    <Container>
      <SettingSubtitle style={{ marginBottom: 5 }}>{t('lmstudio.keep_alive_time.title')}</SettingSubtitle>
      <InputNumber
        style={{ width: '100%' }}
        value={isLocked ? lockedKeepAlive : keepAliveMinutes}
        min={0}
        onChange={(value) => !isLocked && setKeepAliveMinutes(value ? Math.floor(Number(value)) : 0)}
        onBlur={() => !isLocked && setKeepAliveTime(keepAliveMinutes || 0)}
        suffix={t('lmstudio.keep_alive_time.placeholder')}
        step={5}
        disabled={isLocked || isFeatureDisabled('DISABLE_API_HOST_EDITING')}
      />
      <SettingHelpTextRow>
        <SettingHelpText>{t('lmstudio.keep_alive_time.description')}</SettingHelpText>
      </SettingHelpTextRow>
    </Container>
  )
}

const Container = styled.div``

export default LMStudioSettings
