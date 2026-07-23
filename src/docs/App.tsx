import { useState } from 'react'
import {
  AppMotionConfig,
  ErrorBoundary,
  IconProvider,
  IconShapeDefs,
  type AppAnimations,
} from '@satrio/glass-design'
import { Toaster } from 'react-hot-toast'
import { Gallery } from './Gallery'

/**
 * The reference-consumer shell: exactly the provider stack a real app wraps its tree in, composed
 * only from `@satrio/glass-design` root exports + vendor packages. The Gallery's Motion section
 * switches `animations` live to demo all three appAnimations tiers — this drives AppMotionConfig's
 * framer-motion side here (its CSS `data-motion` side the Gallery stamps itself).
 */
export default function App() {
  const [animations, setAnimations] = useState<AppAnimations>('all')
  return (
    <ErrorBoundary>
      <AppMotionConfig animations={animations}>
        <IconProvider>
          <IconShapeDefs />
          <Gallery animations={animations} onAnimationsChange={setAnimations} />
          <Toaster position="bottom-center" />
        </IconProvider>
      </AppMotionConfig>
    </ErrorBoundary>
  )
}
