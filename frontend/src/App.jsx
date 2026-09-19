import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import DashboardView from './components/DashboardView'
import ReportsView from './components/ReportsView'
import ReportDetailView from './components/ReportDetailView'
import CompareView from './components/CompareView'
import AddReportModal from './components/AddReportModal'

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  // Navigation state
  const [currentTab, setCurrentTab] = useState('reports') // 'dashboard' | 'reports' | 'compare' | 'trends'
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [isAddReportOpen, setIsAddReportOpen] = useState(false)
  const [compareInitialCurrId, setCompareInitialCurrId] = useState('')

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

    setAuthLoading(true)

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
      setAuthLoading(false)
    }
  }

  // Handle Logout
  const handleLogout = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut()
      setEmail('')
      setPassword('')
      setErrorMessage('')
      setInfoMessage('')
      setSelectedReportId(null)
      setCurrentTab('reports')
    } catch (err) {
      console.error('Error signing out:', err)
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
  // AUTHENTICATED REAL APP SHELL (STAGE 3)
  // ----------------------------------------------------
  if (session?.user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex flex-col md:flex-row antialiased">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-stone-200/90 flex flex-col justify-between shrink-0">
          <div>
            {/* Logo */}
            <div className="p-6 border-b border-stone-100 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#5B3FE0]/10 text-[#5B3FE0] text-xl font-black flex items-center justify-center">
                Δ
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-stone-900">
                  Lab<span className="text-[#5B3FE0]">Δ</span>
                </h1>
                <p className="text-[10px] text-stone-400 font-medium leading-none">
                  LabDelta Analysis
                </p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-1">
              {/* Dashboard */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('dashboard')
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'dashboard' && !selectedReportId
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0]'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className="text-base">📊</span>
                <span>Dashboard</span>
              </button>

              {/* Reports */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('reports')
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'reports' || selectedReportId
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0]'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className="text-base">📋</span>
                <span>Reports</span>
              </button>

              {/* Compare */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('compare')
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'compare'
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0]'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className="text-base">⚖️</span>
                <span>Compare</span>
              </button>

              {/* Trends (Upcoming) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('trends')
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'trends'
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0]'
                    : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-base">📈</span>
                  <span>Trends</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">
                  Later
                </span>
              </button>
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-stone-100 space-y-3">
            <div className="px-2 py-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                Signed in as
              </span>
              <span className="text-xs font-mono text-stone-700 font-medium truncate block">
                {session.user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 px-3 text-xs font-semibold text-stone-600 hover:text-rose-600 hover:bg-rose-50/70 border border-stone-200 rounded-xl transition-all cursor-pointer text-center block"
            >
              Log Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {selectedReportId ? (
            <ReportDetailView
              reportId={selectedReportId}
              onBack={() => setSelectedReportId(null)}
              onCompare={(reportId) => {
                setCompareInitialCurrId(reportId)
                setSelectedReportId(null)
                setCurrentTab('compare')
              }}
            />
          ) : currentTab === 'dashboard' ? (
            <DashboardView
              onOpenAddReport={() => setIsAddReportOpen(true)}
              onSelectReport={(id) => setSelectedReportId(id)}
              onGoToReports={() => setCurrentTab('reports')}
            />
          ) : currentTab === 'reports' ? (
            <ReportsView
              key={isAddReportOpen ? 'open' : 'closed'}
              onOpenAddReport={() => setIsAddReportOpen(true)}
              onSelectReport={(id) => setSelectedReportId(id)}
            />
          ) : currentTab === 'compare' ? (
            <CompareView
              initialCurrId={compareInitialCurrId}
              onOpenAddReport={() => setIsAddReportOpen(true)}
            />
          ) : currentTab === 'trends' ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center max-w-lg space-y-3 mx-auto mt-12">
              <span className="text-3xl">📈</span>
              <h3 className="text-base font-bold text-stone-900">Biomarker Trends</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Historical marker trend charts and visual trajectories will be implemented in the trends stage.
              </p>
            </div>
          ) : null}
        </main>

        {/* Add Report Modal */}
        <AddReportModal
          isOpen={isAddReportOpen}
          onClose={() => setIsAddReportOpen(false)}
          userId={session.user.id}
          onReportCreated={(newId) => {
            setCurrentTab('reports')
            setSelectedReportId(newId)
          }}
        />

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
            disabled={authLoading}
            className="w-full mt-2 py-3 px-4 bg-[#5B3FE0] hover:bg-[#4d34c7] active:bg-[#432db5] text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-[#5B3FE0]/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
          >
            {authLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <span>{isSignUp ? 'Create LabΔ Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-400">
            Protected by Supabase Authentication
          </p>
        </div>

      </div>
    </div>
  )
}
