// 确保 React 19 兼容性补丁首先加载
import '@ant-design/v5-patch-for-react-19'
import './assets/styles/index.scss'
import './i18n'

import { createRoot } from 'react-dom/client'

import App from './App'

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<App />)
