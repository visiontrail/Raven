import { NavbarHeader } from '@renderer/components/app/Navbar'
import { HStack } from '@renderer/components/Layout'
import SearchPopup from '@renderer/components/Popups/SearchPopup'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { modelGenerating } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useShowAssistants, useShowTopics } from '@renderer/hooks/useStore'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { useAppDispatch } from '@renderer/store'
import { setNarrowMode } from '@renderer/store/settings'
import { Assistant, Topic } from '@renderer/types'
import { Tooltip } from 'antd'
import { t } from 'i18next'
import { Menu, PanelLeftClose, PanelRightClose, Search } from 'lucide-react'
import { FC, useEffect, useState } from 'react'
import styled from 'styled-components'

import { deviceLogMonitorService, UploadStatusPayload } from '@renderer/services/DeviceLogMonitorService'

import AssistantsDrawer from './components/AssistantsDrawer'
import SelectModelButton from './components/SelectModelButton'
import UpdateAppButton from './components/UpdateAppButton'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  setActiveAssistant: (assistant: Assistant) => void
  position: 'left' | 'right'
}

const getLogTypeLabel = (type?: 'protocol' | 'oam_antenna' | 'full') => {
  switch (type) {
    case 'protocol':
      return '协议栈'
    case 'oam_antenna':
      return 'OAM/天线'
    case 'full':
      return '完整日志'
    default:
      return '日志'
  }
}

const truncateText = (text: string, max = 20) => {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

const getStageLabel = (state: UploadStatusPayload['state']) => {
  switch (state) {
    case 'discovering':
      return '检测到新日志'
    case 'downloading':
      return '日志下载中'
    case 'uploading':
      return '日志上传中'
    default:
      return '日志处理中'
  }
}

const HeaderNavbar: FC<Props> = ({ activeAssistant, setActiveAssistant, activeTopic, setActiveTopic }) => {
  const { assistant } = useAssistant(activeAssistant.id)
  const { showAssistants, toggleShowAssistants } = useShowAssistants()
  const { topicPosition, narrowMode } = useSettings()
  const { showTopics, toggleShowTopics } = useShowTopics()
  const dispatch = useAppDispatch()
  const [uploadingStatus, setUploadingStatus] = useState<UploadStatusPayload | null>(null)

  useShortcut('toggle_show_assistants', toggleShowAssistants)

  useShortcut('toggle_show_topics', () => {
    if (topicPosition === 'right') {
      toggleShowTopics()
    } else {
      EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)
    }
  })

  useShortcut('search_message', () => {
    SearchPopup.show()
  })

  useEffect(() => {
    const currentStatus = deviceLogMonitorService.getCurrentUploadStatus()
    if (currentStatus.state !== 'idle') {
      setUploadingStatus(currentStatus)
    }

    const unsubscribe = deviceLogMonitorService.onUploadStatusChange((payload) => {
      console.log('[ChatNavbar] 收到日志上传状态:', payload)
      if (payload.state !== 'idle') {
        setUploadingStatus(payload)
      } else {
        setUploadingStatus(null)
      }
    })
    return unsubscribe
  }, [])

  const handleNarrowModeToggle = async () => {
    await modelGenerating()
    dispatch(setNarrowMode(!narrowMode))
  }

  const onShowAssistantsDrawer = () => {
    AssistantsDrawer.show({
      activeAssistant,
      setActiveAssistant,
      activeTopic,
      setActiveTopic
    })
  }

  return (
    <NavbarHeader className="home-navbar">
      <HeaderSide>
        <HStack alignItems="center">
          {showAssistants && (
            <Tooltip title={t('navbar.hide_sidebar')} mouseEnterDelay={0.8}>
              <NavbarIcon onClick={toggleShowAssistants}>
                <PanelLeftClose size={18} />
              </NavbarIcon>
            </Tooltip>
          )}
          {!showAssistants && (
            <Tooltip title={t('navbar.show_sidebar')} mouseEnterDelay={0.8}>
              <NavbarIcon onClick={() => toggleShowAssistants()} style={{ marginRight: 8 }}>
                <PanelRightClose size={18} />
              </NavbarIcon>
            </Tooltip>
          )}
          {!showAssistants && (
            <NavbarIcon onClick={onShowAssistantsDrawer} style={{ marginRight: 8 }}>
              <Menu size={18} />
            </NavbarIcon>
          )}
          <SelectModelButton assistant={assistant} />
        </HStack>
      </HeaderSide>

      <HeaderCenter>
        {uploadingStatus && (
          <UploadIndicator>
            <UploadText
              title={`${uploadingStatus.fileName || ''}${
                uploadingStatus.logType ? ` (${getLogTypeLabel(uploadingStatus.logType)})` : ''
              }`}>
              {getStageLabel(uploadingStatus.state)}：
              {truncateText(
                `${uploadingStatus.fileName || ''}${
                  uploadingStatus.logType ? ` (${getLogTypeLabel(uploadingStatus.logType)})` : ''
                }`
              )}
            </UploadText>
            <CancelLink onClick={() => deviceLogMonitorService.cancelCurrentUpload()}>取消</CancelLink>
          </UploadIndicator>
        )}
      </HeaderCenter>

      <HeaderSide>
        <HStack alignItems="center" gap={8}>
        <UpdateAppButton />
        <Tooltip title={t('chat.assistant.search.placeholder')} mouseEnterDelay={0.8}>
          <NarrowIcon onClick={() => SearchPopup.show()}>
            <Search size={18} />
          </NarrowIcon>
        </Tooltip>
        <Tooltip title={t('navbar.expand')} mouseEnterDelay={0.8}>
          <NarrowIcon onClick={handleNarrowModeToggle}>
            <i className="iconfont icon-icon-adaptive-width"></i>
          </NarrowIcon>
        </Tooltip>
        {topicPosition === 'right' && !showTopics && (
          <Tooltip title={t('navbar.show_sidebar')} mouseEnterDelay={2}>
            <NavbarIcon onClick={toggleShowTopics}>
              <PanelLeftClose size={18} />
            </NavbarIcon>
          </Tooltip>
        )}
        {topicPosition === 'right' && showTopics && (
          <Tooltip title={t('navbar.hide_sidebar')} mouseEnterDelay={2}>
            <NavbarIcon onClick={toggleShowTopics}>
              <PanelRightClose size={18} />
            </NavbarIcon>
          </Tooltip>
        )}
        </HStack>
      </HeaderSide>
    </NavbarHeader>
  )
}

const HeaderSide = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`

const HeaderCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
`

const UploadIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text);
  max-width: 260px;
`

const UploadText = styled.span`
  display: inline-block;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const CancelLink = styled.span`
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
`

export const NavbarIcon = styled.div`
  -webkit-app-region: none;
  border-radius: 8px;
  height: 30px;
  padding: 0 7px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  .iconfont {
    font-size: 18px;
    color: var(--color-icon);
    &.icon-a-addchat {
      font-size: 20px;
    }
    &.icon-a-darkmode {
      font-size: 20px;
    }
    &.icon-appstore {
      font-size: 20px;
    }
  }
  .anticon {
    color: var(--color-icon);
    font-size: 16px;
  }
  &:hover {
    background-color: var(--color-background-mute);
    color: var(--color-icon-white);
  }
`

const NarrowIcon = styled(NavbarIcon)`
  @media (max-width: 1000px) {
    display: none;
  }
`

export default HeaderNavbar
