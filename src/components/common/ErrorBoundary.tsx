import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level error boundary. Renders a readable fallback instead of a blank
 * white screen when a render-time error escapes (e.g. missing Supabase env
 * config throwing on first useAuth mount).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: 'var(--space-3)',
          }}
        >
          <div
            className="panel-material"
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-card)',
              color: 'var(--label)',
              maxWidth: '32rem',
            }}
          >
            <h1>Something went wrong</h1>
            <p>{this.state.error.message}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
