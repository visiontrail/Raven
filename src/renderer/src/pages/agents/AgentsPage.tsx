import { FC, useState } from 'react'

import AgentChatWorkbench from './aiservice/AgentChatWorkbench'
import TemplateAgentsView from './components/TemplateAgentsView'

const AgentsPage: FC = () => {
  const [view, setView] = useState<'workbench' | 'templates'>('workbench')

  if (view === 'templates') {
    return <TemplateAgentsView onSwitchToWorkbench={() => setView('workbench')} />
  }

  return <AgentChatWorkbench onSwitchToTemplates={() => setView('templates')} />
}

export default AgentsPage
