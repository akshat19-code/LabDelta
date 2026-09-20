import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ReportsContext = createContext({
  reports: [],
  measurements: [],
  loading: true,
  isRefreshing: false,
  isLoaded: false,
  error: '',
  refreshData: async () => {},
  clearCache: () => {},
})

export function ReportsDataProvider({ children, userId }) {
  const [reports, setReports] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState('')

  // Track the active user ID to strictly isolate cache between accounts
  const activeUserRef = useRef(userId)
  const hasLoadedOnceRef = useRef(false)

  const clearCache = useCallback(() => {
    setReports([])
    setMeasurements([])
    setIsLoaded(false)
    setLoading(false)
    setIsRefreshing(false)
    setError('')
    hasLoadedOnceRef.current = false
  }, [])

  /**
   * Refreshes reports and measurements from Supabase.
   * - If initial load (no cached data), shows blocking loader.
   * - If already cached, keeps previous data visible while refreshing in background.
   * - On failure, preserves existing valid cached data and surfaces error.
   */
  const refreshData = useCallback(async (options = {}) => {
    if (!userId) return

    const isInitial = !hasLoadedOnceRef.current
    if (isInitial || options.forceBlocking) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError('')

    try {
      const [repRes, measRes] = await Promise.all([
        supabase
          .from('reports')
          .select('id, report_date, lab_name, source_type, created_at')
          .order('report_date', { ascending: false }),
        supabase
          .from('measurements')
          .select('*'),
      ])

      if (repRes.error) throw repRes.error
      if (measRes.error) throw measRes.error

      // Check if user is still the same when response returns
      if (activeUserRef.current === userId) {
        setReports(repRes.data || [])
        setMeasurements(measRes.data || [])
        setIsLoaded(true)
        hasLoadedOnceRef.current = true
        setError('')
      }
    } catch (err) {
      console.error('[ReportsContext] Failed to refresh data:', err)
      // PRESERVE previous cached data on failure — do not blank the UI
      setError(err.message || 'Failed to load report data.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [userId])

  // Synchronize on userId change (initial login, account change, or logout)
  useEffect(() => {
    activeUserRef.current = userId
    if (!userId) {
      clearCache()
      return
    }

    // New user session: reset state and perform initial fetch
    hasLoadedOnceRef.current = false
    setLoading(true)
    refreshData()
  }, [userId, refreshData, clearCache])

  const value = {
    reports,
    measurements,
    loading,
    isRefreshing,
    isLoaded,
    error,
    refreshData,
    clearCache,
    hasProvider: true,
  }

  return (
    <ReportsContext.Provider value={value}>
      {children}
    </ReportsContext.Provider>
  )
}

export function useReportsData() {
  const ctx = useContext(ReportsContext)
  if (!ctx || !ctx.hasProvider) {
    return {
      reports: [],
      measurements: [],
      loading: false,
      isRefreshing: false,
      isLoaded: false,
      error: '',
      refreshData: async () => {},
      clearCache: () => {},
      hasProvider: false,
    }
  }
  return ctx
}
