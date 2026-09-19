import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

function App() {
  const [session, setSession] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  // Backend verification state for authenticated user
  const [backendVerification, setBackendVerification] = useState({
    status: 'idle', // 'idle' | 'loading' | 'verified' | 'error'
    data: null,
    error: null,
  })

  // 1. Initial session check and auth listener
  useEffect(() => {
    if (!supabase) {
      setLoadingInitial(false)
      setErrorMessage('Supabase client is not initialized. Please verify your .env configuration.')
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingInitial(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoadingInitial(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Verify Supabase access token with FastAPI /auth/me
  useEffect(() => {
    if (!session?.access_token) {
      setBackendVerification({ status: 'idle', data: null, error: null })
      return
    }

    let isMounted = true
    const verifyWithBackend = async () => {
      setBackendVerification({ status: 'loading', data: null, error: null })
      try {
        const response = await fetch(`${BACKEND_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || `Backend returned status ${response.status}`)
        }

        const data = await response.json()
        if (isMounted) {
          setBackendVerification({ status: 'verified', data, error: null })
        }
      } catch (err) {
        if (isMounted) {
          setBackendVerification({
            status: 'error',
            data: null,
            error: err.message || 'Failed to verify token with FastAPI',
          })
        }
      }
    }

    verifyWithBackend()
    return () => {
      isMounted = false
    }
  }, [session])

  // Handle Form Submit (Sign in or Sign up)
  const handleAuth = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setInfoMessage('')

    if (!supabase) {
      setErrorMessage('Supabase client is not available. Please check environment variables.')
      return
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both email and password.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (error) throw error

        if (data?.session) {
          setInfoMessage('Account created successfully!')
        } else {
          setInfoMessage(
            'Account created! Please check your email inbox to confirm your registration before logging in.'
          )
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Logout
  const handleLogout = async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setEmail('')
      setPassword('')
      setErrorMessage('')
      setInfoMessage('')
    } catch (err) {
      setErrorMessage(err.message || 'Error signing out.')
    } finally {
      setLoading(false)
    }
  }

  // Loading screen during initial session detection
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-3 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-stone-600">Initializing LabΔ session...</p>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // AUTHENTICATED TEMPORARY VIEW
  // ----------------------------------------------------
  if (session?.user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col items-center justify-center p-6 antialiased">
        <div className="w-full max-w-lg bg-white border border-stone-200/90 rounded-2xl shadow-xl shadow-stone-200/50 p-8 md:p-10 space-y-8">
          
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#5B3FE0]/10 text-[#5B3FE0] text-3xl font-extrabold mb-1">
              Δ
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">
              Lab<span className="text-[#5B3FE0]">Δ</span>
            </h1>
            <p className="text-sm text-stone-500 font-medium">
              Compare Lab Reports. See What Changed.
            </p>
          </div>

          {/* Welcome Card */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-center space-y-3">
            <h2 className="text-xl font-semibold text-stone-900">
              Welcome to Lab<span className="text-[#5B3FE0]">Δ</span>
            </h2>
            <div className="inline-block px-3 py-1 bg-white border border-stone-200 rounded-full text-xs font-mono font-medium text-stone-700 shadow-2xs">
              {session.user.email}
            </div>
            <p className="text-stone-600 text-sm pt-1">
              Your LabDelta workspace is ready.
            </p>
          </div>

          {/* Backend Verification Status Card */}
          <div className="border border-stone-200 rounded-xl p-5 space-y-3 bg-white">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-500">
              <span>FastAPI Auth Verification</span>
              <span className="font-mono lowercase text-[11px] text-stone-400">GET /auth/me</span>
            </div>

            {backendVerification.status === 'loading' && (
              <div className="flex items-center space-x-2 text-stone-600 text-sm py-1">
                <div className="w-4 h-4 border-2 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
                <span>Verifying Supabase bearer token with FastAPI...</span>
              </div>
            )}

            {backendVerification.status === 'verified' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-emerald-700 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>FastAPI Verified Authenticated User</span>
                </div>
                <div className="bg-stone-900 text-stone-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  {JSON.stringify(backendVerification.data, null, 2)}
                </div>
              </div>
            )}

            {backendVerification.status === 'error' && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-rose-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Backend Verification Failed</span>
                </div>
                <p className="bg-rose-50 text-rose-700 border border-rose-200 p-2.5 rounded-lg font-mono">
                  {backendVerification.error}
                </p>
              </div>
            )}
          </div>

          {/* Logout Action */}
          <div className="pt-2">
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-400 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? 'Logging out...' : 'Log Out'}
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // AUTHENTICATION SCREEN (LOGIN / SIGN UP)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col items-center justify-center p-6 antialiased">
      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl shadow-xl shadow-stone-200/50 p-8 md:p-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#5B3FE0]/10 text-[#5B3FE0] text-2xl font-black mb-1">
            Δ
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
            Lab<span className="text-[#5B3FE0]">Δ</span>
          </h1>
          <p className="text-sm text-stone-500 font-medium">
            Compare Lab Reports. See What Changed.
          </p>
        </div>

        {/* Tab Toggle: Login vs Sign Up */}
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/70">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false)
              setErrorMessage('')
              setInfoMessage('')
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isSignUp
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true)
              setErrorMessage('')
              setInfoMessage('')
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isSignUp
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-700 font-medium flex items-start space-x-2">
            <span className="text-rose-500 font-bold">•</span>
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Info / Success Alert */}
        {infoMessage && (
          <div className="p-3.5 bg-violet-50 border border-violet-200/80 rounded-xl text-xs text-violet-800 font-medium flex items-start space-x-2">
            <span className="text-[#5B3FE0] font-bold">•</span>
            <span className="flex-1">{infoMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full px-3.5 py-2.5 bg-stone-50/60 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-colors"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 bg-stone-50/60 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-colors"
            />
            {isSignUp && (
              <p className="text-[11px] text-stone-400">Must be at least 6 characters.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-[#5B3FE0] hover:bg-[#4d34c7] active:bg-[#432db5] text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-[#5B3FE0]/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <span>{isSignUp ? 'Create LabΔ Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-400">
            Protected by Supabase Authentication
          </p>
        </div>

      </div>
    </div>
  )
}

export default App
