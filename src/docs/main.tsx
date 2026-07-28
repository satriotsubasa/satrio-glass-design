import '@satrio/glass-design/fonts'
import '@satrio/glass-design/styles/global.css'
// The backdrop system is opt-in: this import is what lets the Gallery's Backdrop section (and
// its `<html data-backdrop>` switcher) actually paint. docs-brand.css plays the consumer, setting
// --backdrop-image for the `wallpaper` preset — see that file for the real per-theme contract.
import '@satrio/glass-design/styles/backdrops.css'
import './docs-brand.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
