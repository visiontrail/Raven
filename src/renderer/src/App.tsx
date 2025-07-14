import '@renderer/databases'

import { initializeDefaultMinApps } from '@renderer/config/minapps'
import store, { persistor } from '@renderer/store'
import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'

import Sidebar from './components/app/Sidebar'
import TopViewContainer from './components/TopView'
import AntdProvider from './context/AntdProvider'
import { CodeStyleProvider } from './context/CodeStyleProvider'
import { NotificationProvider } from './context/NotificationProvider'
import StyleSheetManager from './context/StyleSheetManager'
import { ThemeProvider } from './context/ThemeProvider'
import NavigationHandler from './handler/NavigationHandler'
import AgentsPage from './pages/agents/AgentsPage'
import AppsPage from './pages/apps/AppsPage'
import FilesPage from './pages/files/FilesPage'
import HomePage from './pages/home/HomePage'
import KnowledgePage from './pages/knowledge/KnowledgePage'
import SettingsPage from './pages/settings/SettingsPage'

// 初始化组件
function AppInitializer() {
  useEffect(() => {
    // 在应用启动时初始化自定义小应用
    initializeDefaultMinApps().catch(console.error)
  }, [])

  return null
}

function App(): React.ReactElement {
  return (
    <Provider store={store}>
      <StyleSheetManager>
        <ThemeProvider>
          <AntdProvider>
            <NotificationProvider>
              <CodeStyleProvider>
                <PersistGate loading={null} persistor={persistor}>
                  <AppInitializer />
                  <TopViewContainer>
                    <HashRouter>
                      <NavigationHandler />
                      <Sidebar />
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/files" element={<FilesPage />} />
                        <Route path="/knowledge" element={<KnowledgePage />} />
                        <Route path="/settings/*" element={<SettingsPage />} />
                      </Routes>
                    </HashRouter>
                  </TopViewContainer>
                </PersistGate>
              </CodeStyleProvider>
            </NotificationProvider>
          </AntdProvider>
        </ThemeProvider>
      </StyleSheetManager>
    </Provider>
  )
}

export default App
