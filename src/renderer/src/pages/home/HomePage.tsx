import { useAssistants, useDefaultAssistant } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useActiveTopic } from '@renderer/hooks/useTopic'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import NavigationService from '@renderer/services/NavigationService'
import type { Assistant } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { FC, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import Chat from './Chat'
import Navbar from './Navbar'
import HomeTabs from './Tabs'

let _activeAssistant: Assistant

const HomePage: FC = () => {
  const { assistants, addAssistant } = useAssistants()
  const { defaultAssistant } = useDefaultAssistant()
  const navigate = useNavigate()

  const location = useLocation()
  const state = location.state

  const [activeAssistant, setActiveAssistant] = useState(state?.assistant || _activeAssistant || assistants[0])
  const { activeTopic, setActiveTopic } = useActiveTopic(activeAssistant, state?.topic)
  const { showAssistants, showTopics, topicPosition } = useSettings()

  _activeAssistant = activeAssistant

  useEffect(() => {
    NavigationService.setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    state?.assistant && setActiveAssistant(state?.assistant)
    state?.topic && setActiveTopic(state?.topic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Ensure we set a default assistant once assistants list becomes available
  useEffect(() => {
    if (!activeAssistant && assistants && assistants.length > 0) {
      setActiveAssistant(assistants[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistants])

  // Seed a default assistant if none exist (safety for fresh or corrupted state)
  useEffect(() => {
    if (assistants && assistants.length === 0) {
      const assistant = { ...defaultAssistant, id: uuid() }
      if (import.meta.env.DEV) {
        console.debug('[HomePage] seeding default assistant', assistant)
      }
      addAssistant(assistant)
      setActiveAssistant(assistant)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistants?.length])

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[HomePage] state', {
        assistantsCount: assistants?.length,
        activeAssistantId: activeAssistant?.id,
        activeTopicId: activeTopic?.id
      })
    }
  }, [assistants, activeAssistant?.id, activeTopic?.id])

  useEffect(() => {
    const unsubscribe = EventEmitter.on(EVENT_NAMES.SWITCH_ASSISTANT, (assistantId: string) => {
      const newAssistant = assistants.find((a) => a.id === assistantId)
      if (newAssistant) {
        setActiveAssistant(newAssistant)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [assistants, setActiveAssistant])

  useEffect(() => {
    const canMinimize = topicPosition == 'left' ? !showAssistants : !showAssistants && !showTopics
    window.api.window.setMinimumSize(canMinimize ? 520 : 1080, 600)

    return () => {
      window.api.window.resetMinimumSize()
    }
  }, [showAssistants, showTopics, topicPosition])

  if (!activeAssistant) {
    return <Container id="home-page" />
  }

  return (
    <Container id="home-page">
      {activeAssistant && (
        <Navbar
          activeAssistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveTopic={setActiveTopic}
          setActiveAssistant={setActiveAssistant}
          position="left"
        />
      )}
      <ContentContainer id="content-container">
        {showAssistants && activeAssistant && (
          <HomeTabs
            activeAssistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveAssistant={setActiveAssistant}
            setActiveTopic={setActiveTopic}
            position="left"
          />
        )}
        {activeAssistant && activeTopic && (
          <Chat
            assistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            setActiveAssistant={setActiveAssistant}
          />
        )}
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  max-width: calc(100vw - var(--sidebar-width));
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
`

export default HomePage
