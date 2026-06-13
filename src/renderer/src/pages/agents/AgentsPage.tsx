import { FC, useState } from 'react'

import AIServiceWorkbench from './components/AIServiceWorkbench'
import TemplateAgentsView from './components/TemplateAgentsView'

const AgentsPage: FC = () => {
  const [view, setView] = useState<'workbench' | 'templates'>('workbench')

  if (view === 'templates') {
    return <TemplateAgentsView onSwitchToWorkbench={() => setView('workbench')} />
  }

  return <AIServiceWorkbench onSwitchToTemplates={() => setView('templates')} />
}

export default AgentsPage
