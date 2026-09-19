import { useState, useEffect } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

function App() {
  const [status, setStatus] = useState('loading') // 'loading' | 'connected' | 'error'
  const [healthData, setHealthData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const checkHealth = async () => {
    setStatus('loading')
    setErrorMessage('')
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`)
      }
      const data = await response.json()
      if (data.status === 'ok') {
        setHealthData(data)
        setStatus('connected')
      } else {
        throw new Error(`Unexpected response: ${JSON.stringify(data)}`)
      }
    } catch (err) {
      setStatus('error')
      setErrorMessage(
        `Failed to reach backend at ${BACKEND_URL}/health. ${err.message || 'Network error'}`
      )
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-8 text-center space-y-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Lab<span className="text-cyan-400">Δ</span>
          </h1>
          <p className="text-sm text-slate-400">Foundation Health Status</p>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-300">Checking backend connection...</p>
          </div>
        )}

        {status === 'connected' && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold text-lg">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LabΔ — Backend connected</span>
            </div>
            {healthData && (
              <p className="text-xs text-emerald-300/80 font-mono">
                {JSON.stringify(healthData)}
              </p>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="bg-rose-950/60 border border-rose-500/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-rose-400 font-semibold">
              <span className="inline-block w-3 h-3 rounded-full bg-rose-500"></span>
              <span>Backend Connection Error</span>
            </div>
            <p className="text-xs text-rose-200/90 text-left bg-rose-900/40 p-3 rounded font-mono break-all">
              {errorMessage}
            </p>
            <button
              onClick={checkHealth}
              className="mt-2 w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
          Target: <code className="text-slate-400">{BACKEND_URL}/health</code>
        </div>
      </div>
    </div>
  )
}

export default App
