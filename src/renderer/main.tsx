import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { errorMonitor } from '../utils/errorMonitor'
import './index.css'

// 初始化全局错误监控
errorMonitor.init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
