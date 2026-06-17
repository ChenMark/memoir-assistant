import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useVisualViewport } from './hooks/useVisualViewport'

// 必须在 React 树内挂载以触发 hook
function Root() {
  useVisualViewport()
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
