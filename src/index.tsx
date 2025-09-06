import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css' // Optional: for global styles

const render = (domElement: HTMLElement, props: any) => {
  const root = ReactDOM.createRoot(domElement)
  root.render(<App {...props} />)
}

if (typeof window !== 'undefined') {
  ;(window as any).ChatApp = render
  const rootElement = document.getElementById('chat-root')
  if (rootElement) {
    render(rootElement, {})
  }
}

export default render
