import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import DashboardView from './components/DashboardView'
import ReportsView from './components/ReportsView'
import ReportDetailView from './components/ReportDetailView'
import CompareView from './components/CompareView'
import TrendsView from './components/TrendsView'
import AddReportModal from './components/AddReportModal'
import AuthHeroAnimation, { CompactAuthHero } from './components/AuthHeroAnimation'
import { ReportsDataProvider } from './context/ReportsContext'

// Theme Toggle Segmented Control Component
function ThemeToggle({ theme, onChange, className = '' }) {
  return (
    <div
      className={`relative inline-flex items-center p-1 bg-stone-100 dark:bg-[#0F172A] border border-stone-200/80 dark:border-slate-800 rounded-xl select-none transition-colors ${className}`}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {/* Sliding indicator pill */}
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-[#1E293B] rounded-lg shadow-xs transition-all duration-200 ease-out border border-stone-200/60 dark:border-slate-700/80 ${
          theme === 'dark' ? 'left-[calc(50%+2px)]' : 'left-1'
        }`}
        aria-hidden="true"
      />

      {/* Light Option Button */}
      <button
        type="button"
        role="radio"
        aria-label="Switch to light mode"
        aria-checked={theme === 'light'}
        onClick={() => onChange('light')}
        className={`relative z-1 flex-1 flex items-center justify-center space-x-1.5 py-1 px-2.5 text-xs sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] ${
          theme === 'light'
            ? 'text-stone-900 dark:text-stone-100 font-bold'
            : 'text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        <span className={`text-xs transition-transform duration-200 ${theme === 'light' ? 'rotate-0 scale-110' : '-rotate-45 opacity-70'}`}>☀️</span>
        <span>Light</span>
      </button>

      {/* Dark Option Button */}
      <button
        type="button"
        role="radio"
        aria-label="Switch to dark mode"
        aria-checked={theme === 'dark'}
        onClick={() => onChange('dark')}
        className={`relative z-1 flex-1 flex items-center justify-center space-x-1.5 py-1 px-2.5 text-xs sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] ${
          theme === 'dark'
            ? 'text-stone-900 dark:text-stone-100 font-bold'
            : 'text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        <span className={`text-xs transition-transform duration-200 ${theme === 'dark' ? 'rotate-0 scale-110' : 'rotate-45 opacity-70'}`}>🌙</span>
        <span>Dark</span>
      </button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  // Theme state with pre-paint sync & localStorage persistence
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('labdelta_theme')
      if (stored === 'dark' || stored === 'light') return stored
      return 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('labdelta_theme', theme)
    } catch (e) {
      console.warn('Could not save theme preference:', e)
    }
  }, [theme])

  const toggleTheme = (newTheme) => {
    setTheme(newTheme)
  }

  // Navigation state
  const [currentTab, setCurrentTab] = useState('dashboard') // 'dashboard' | 'reports' | 'compare' | 'trends'
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [isAddReportOpen, setIsAddReportOpen] = useState(false)
  const [compareInitialCurrId, setCompareInitialCurrId] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Global Toast state
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success', action = null) => {
    setToast({ message, type, action })
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [toast])

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
      setCurrentTab('dashboard')
      setMobileMenuOpen(false)
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const navigateTo = (tab) => {
    setSelectedReportId(null)
    setCurrentTab(tab)
    setMobileMenuOpen(false)
  }

  // Loading screen during initial session detection
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          <div className="w-10 h-10 border-3 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-stone-600">Initializing LabΔ session...</p>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // AUTHENTICATED REAL APP SHELL (STAGE 7 POLISH)
  // ----------------------------------------------------
  if (session?.user) {
    return (
      <ReportsDataProvider userId={session.user.id}>
        <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#F8F9FA] dark:bg-[#0B0F19] text-stone-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors duration-200">
          {/* Mobile Top Header Bar */}
        <header className="md:hidden bg-white border-b border-stone-200/90 dark:bg-[#0E1524] dark:border-slate-800 px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-lg font-black flex items-center justify-center">
              Δ
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-stone-900 dark:text-slate-100 block leading-tight">
                Lab<span className="text-[#5B3FE0]">Δ</span>
              </span>
              <span className="text-[10px] text-stone-500 dark:text-slate-400 font-medium tracking-tight block">
                Report Intelligence
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              onClick={() => setIsAddReportOpen(true)}
              className="btn-primary px-3 py-1.5 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
            >
              <span className="text-xs font-bold leading-none">+</span>
              <span>Add</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-1.5 text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-slate-100 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/80 transition-colors"
            >
              <span className="text-sm font-bold">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer Backdrop */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-stone-900/30 dark:bg-black/50 backdrop-blur-xs z-40 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Navigation Drawer */}
        <div
          className={`md:hidden fixed top-0 right-0 bottom-0 w-64 bg-white dark:bg-[#0E1524] dark:border-l dark:border-slate-800 z-50 shadow-2xl flex flex-col justify-between transition-transform duration-200 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div>
            <div className="p-4 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-lg font-black flex items-center justify-center">
                  Δ
                </div>
                <span className="font-bold text-base text-stone-900 dark:text-slate-100">Navigation</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <nav className="p-3 space-y-1.5">
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'dashboard' && !selectedReportId
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0]'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">📊</span>
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('reports')}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'reports' || selectedReportId
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0]'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">📋</span>
                <span>Reports</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('compare')}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'compare'
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0]'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">⚖️</span>
                <span>Compare</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('trends')}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'trends'
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0]'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">📈</span>
                <span>Trends</span>
              </button>
            </nav>
          </div>

          <div className="p-3.5 border-t border-stone-100 dark:border-slate-800 space-y-2.5">
            <div>
              <span className="text-[11px] uppercase font-bold text-stone-400 dark:text-slate-500 tracking-wider block mb-1">
                Theme
              </span>
              <ThemeToggle theme={theme} onChange={toggleTheme} className="w-full" />
            </div>
            <div className="px-1 pt-0.5">
              <span className="text-[11px] uppercase font-bold text-stone-400 dark:text-slate-500 tracking-wider block">
                Signed in as
              </span>
              <span className="text-xs font-mono text-stone-700 dark:text-slate-300 font-medium truncate block" title={session.user.email}>
                {session.user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 rounded-xl transition-all cursor-pointer text-center block btn-press"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Desktop Left Sidebar */}
        <aside className="hidden md:flex w-64 lg:w-72 bg-white dark:bg-[#0E1524] border-r border-stone-200/90 dark:border-slate-800 flex-col justify-between shrink-0 h-screen sticky top-0 transition-colors duration-200 overflow-y-auto">
          <div>
            {/* Logo */}
            <div className="p-4.5 lg:p-5 border-b border-stone-100 dark:border-slate-800 flex items-center space-x-3 group cursor-default">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-xl lg:text-2xl font-black flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-[#5B3FE0]/20">
                Δ
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-black tracking-tight text-stone-900 dark:text-slate-100 leading-tight">
                  Lab<span className="text-[#5B3FE0]">Δ</span>
                </h1>
                <p className="text-[11px] text-stone-500 dark:text-slate-400 font-semibold tracking-wide uppercase mt-0.5">
                  Report Intelligence
                </p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-3 lg:p-3.5 space-y-1.5">
              {/* Dashboard */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('dashboard')
                }}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'dashboard' && !selectedReportId
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0] shadow-2xs'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">📊</span>
                <span>Dashboard</span>
              </button>

              {/* Reports */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('reports')
                }}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'reports' || selectedReportId
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0] shadow-2xs'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">📋</span>
                <span>Reports</span>
              </button>

              {/* Compare */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('compare')
                }}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'compare'
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0] shadow-2xs'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">⚖️</span>
                <span>Compare</span>
              </button>

              {/* Trends */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null)
                  setCurrentTab('trends')
                }}
                className={`w-full group flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer btn-press ${
                  currentTab === 'trends'
                    ? 'bg-[#5B3FE0]/10 text-[#5B3FE0] dark:bg-[#5B3FE0]/20 dark:text-[#8266FA] font-bold border-l-3 border-[#5B3FE0] shadow-2xs'
                    : 'text-stone-600 dark:text-slate-400 hover:bg-stone-100/70 dark:hover:bg-slate-800/60 hover:text-stone-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">📈</span>
                <span>Trends</span>
              </button>
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div className="p-3.5 lg:p-4 border-t border-stone-100 dark:border-slate-800 space-y-2.5">
            <div>
              <span className="text-[11px] uppercase font-bold text-stone-400 dark:text-slate-500 tracking-wider block mb-1">
                Theme
              </span>
              <ThemeToggle theme={theme} onChange={toggleTheme} className="w-full" />
            </div>
            <div className="px-1 py-0.5">
              <span className="text-[11px] uppercase font-bold text-stone-400 dark:text-slate-500 tracking-wider block">
                Signed in as
              </span>
              <span
                className="text-xs font-mono text-stone-700 dark:text-slate-300 font-medium truncate block mt-0.5"
                title={session.user.email}
              >
                {session.user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary w-full py-2 px-2.5 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 border border-stone-200 dark:border-slate-800 rounded-xl transition-all cursor-pointer text-center block"
            >
              Log Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 overflow-y-auto w-full h-full md:h-screen">
          <div className="max-w-6xl mx-auto w-full">
            {/* Global Toast Notification */}
            {toast && (
              <div className="mb-4 p-3 sm:p-3.5 bg-white dark:bg-[#131B2E] border border-[#5B3FE0]/30 dark:border-[#5B3FE0]/40 rounded-xl shadow-lg shadow-[#5B3FE0]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-slide-up">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    ✓
                  </div>
                  <span className="text-sm font-medium text-stone-800 dark:text-slate-200">
                    {toast.message}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {toast.action && (
                    <button
                      onClick={() => {
                        toast.action.onClick()
                        setToast(null)
                      }}
                      className="px-3.5 py-1.5 bg-[#5B3FE0] hover:bg-[#4d34c7] text-white text-xs font-semibold rounded-xl btn-press cursor-pointer"
                    >
                      {toast.action.label}
                    </button>
                  )}
                  <button
                    onClick={() => setToast(null)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs rounded-lg"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic View with Content Entrance Animation */}
            <div key={currentTab + (selectedReportId || '')} className="animate-fade-in animate-slide-up">
              {selectedReportId ? (
                <ReportDetailView
                  reportId={selectedReportId}
                  onBack={() => setSelectedReportId(null)}
                  onCompare={(reportId) => {
                    setCompareInitialCurrId(reportId)
                    setSelectedReportId(null)
                    setCurrentTab('compare')
                  }}
                  theme={theme}
                />
              ) : currentTab === 'dashboard' ? (
                <DashboardView
                  onOpenAddReport={() => setIsAddReportOpen(true)}
                  onSelectReport={(id) => setSelectedReportId(id)}
                  onGoToReports={() => setCurrentTab('reports')}
                  onGoToCompare={() => setCurrentTab('compare')}
                  onGoToTrends={() => setCurrentTab('trends')}
                  userId={session.user.id}
                  showToast={showToast}
                  theme={theme}
                />
              ) : currentTab === 'reports' ? (
                <ReportsView
                  key={isAddReportOpen ? 'open' : 'closed'}
                  onOpenAddReport={() => setIsAddReportOpen(true)}
                  onSelectReport={(id) => setSelectedReportId(id)}
                  userId={session.user.id}
                  showToast={showToast}
                  theme={theme}
                />
              ) : currentTab === 'compare' ? (
                <CompareView
                  initialCurrId={compareInitialCurrId}
                  onOpenAddReport={() => setIsAddReportOpen(true)}
                  theme={theme}
                />
              ) : currentTab === 'trends' ? (
                <TrendsView
                  onOpenAddReport={() => setIsAddReportOpen(true)}
                  theme={theme}
                />
              ) : null}
            </div>
          </div>
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
          theme={theme}
        />
      </div>
    </ReportsDataProvider>
  )
}

  // ----------------------------------------------------
  // AUTHENTICATION SCREEN (LOGIN / SIGN UP with AMBIENT GLOW)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] dark:bg-[#0B0F19] text-stone-900 dark:text-slate-100 flex flex-col justify-between p-3 sm:p-4 lg:px-6 lg:py-3 antialiased relative transition-colors duration-200">
      {/* Top Header Bar with Theme Switcher: naturally flows above main content without overlap */}
      <header className="w-full max-w-6xl mx-auto flex justify-end items-center shrink-0 z-20 pb-1">
        <ThemeToggle theme={theme} onChange={toggleTheme} />
      </header>

      {/* Subtle Ambient Background Depth isolated from flex layout */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#5B3FE0]/15 dark:bg-[#5B3FE0]/25 blur-3xl -top-10 -right-10 sm:-top-20 sm:-right-20 animate-ambient-glow"
          aria-hidden="true"
        />
        <div
          className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-[#8B5CF6]/10 dark:bg-[#8B5CF6]/15 blur-3xl -bottom-10 -left-10 sm:-bottom-20 sm:-left-20 animate-ambient-glow"
          style={{ animationDelay: '7s' }}
          aria-hidden="true"
        />
      </div>

      {/* Main Container: Split Hero on Desktop, Compact on Mobile */}
      <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col lg:flex-row items-center justify-center gap-5 lg:gap-7 xl:gap-10 relative z-10 my-auto">
        {/* Left Column: Signature LabΔ Hero Animation (Desktop / Large Screen) */}
        <div className="hidden lg:flex flex-1 items-center justify-center max-w-xl xl:max-w-2xl">
          <AuthHeroAnimation theme={theme} />
        </div>

        {/* Right Column: Authentication Card & Mobile Compact Hero */}
        <div className="w-full max-w-sm sm:max-w-[390px] lg:max-w-[370px] xl:max-w-[400px] shrink-0 flex flex-col items-center">
          {/* Compact Mobile Banner for <= 640px phones */}
          <div className="lg:hidden w-full">
            <CompactAuthHero />
          </div>

          <div className="w-full bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-stone-200/60 dark:shadow-black/60 p-4.5 sm:p-5.5 lg:p-5 xl:p-6 space-y-3 sm:space-y-3.5 relative z-10 animate-fade-in animate-slide-up">
            {/* Brand Header */}
            <div className="text-center space-y-0.5 sm:space-y-1">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-xl sm:text-2xl font-black mb-0.5">
                Δ
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
                Lab<span className="text-[#5B3FE0]">Δ</span>
              </h1>
              <p className="text-xs text-stone-500 dark:text-slate-400 font-medium">
                Compare Lab Reports. See What Changed.
              </p>
            </div>

            {/* Tab Toggle: Login vs Sign Up */}
            <div className="flex bg-stone-100 dark:bg-slate-900/90 p-1 rounded-xl border border-stone-200/70 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false)
                  setErrorMessage('')
                  setInfoMessage('')
                }}
                className={`flex-1 py-1.5 sm:py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  !isSignUp
                    ? 'bg-white dark:bg-[#1E293B] text-stone-900 dark:text-slate-100 shadow-xs'
                    : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
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
                className={`flex-1 py-1.5 sm:py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isSignUp
                    ? 'bg-white dark:bg-[#1E293B] text-stone-900 dark:text-slate-100 shadow-xs'
                    : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="p-2.5 sm:p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-medium flex items-start space-x-2 animate-fade-in">
                <span className="text-rose-500 font-bold">•</span>
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            {/* Info / Success Alert */}
            {infoMessage && (
              <div className="p-2.5 sm:p-3 bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-900/60 rounded-xl text-xs sm:text-sm text-violet-800 dark:text-violet-300 font-medium flex items-start space-x-2 animate-fade-in">
                <span className="text-[#5B3FE0] font-bold">•</span>
                <span className="flex-1">{infoMessage}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuth} className="space-y-2.5 sm:space-y-3">
              <div className="space-y-1 text-left">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-slate-400">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-3 py-2 sm:py-2.5 bg-stone-50/70 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0] focus:bg-white dark:focus:bg-slate-900 shadow-2xs transition-all"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-slate-400">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 sm:py-2.5 bg-stone-50/70 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0] focus:bg-white dark:focus:bg-slate-900 shadow-2xs transition-all"
                />
                {isSignUp && (
                  <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-500">Must be at least 6 characters.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-1 py-2 sm:py-2.5 px-4 btn-primary flex items-center justify-center space-x-2 shadow-md shadow-[#5B3FE0]/25 text-xs sm:text-sm font-bold cursor-pointer"
              >
                {authLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <span>{isSignUp ? 'Create LabΔ Account' : 'Sign In'}</span>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="text-center pt-1 border-t border-stone-100 dark:border-slate-800">
              <p className="text-[11px] text-stone-400 dark:text-slate-500 flex items-center justify-center space-x-1.5">
                <span>🔒</span>
                <span>Your reports stay private to your account.</span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Subtle Safe Area */}
      <footer className="w-full shrink-0 h-1.5 sm:h-2" />
    </div>
  )
}
