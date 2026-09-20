import { useState, useEffect, useRef } from 'react'

export default function AuthHeroAnimation({ theme }) {
  const [step, setStep] = useState(1)
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 })
  const [reducedMotion, setReducedMotion] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    // Check prefers-reduced-motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)

    if (mq.matches) {
      setStep(8) // Immediately complete
      return
    }

    // Sequence timer: advances steps 1 -> 8 in ~3.5 seconds total, then settles
    const timers = [
      setTimeout(() => setStep(2), 400),  // Step 2: Current report enters
      setTimeout(() => setStep(3), 900),  // Step 3: Matching rows highlight
      setTimeout(() => setStep(4), 1450), // Step 4: Connectors draw
      setTimeout(() => setStep(5), 2050), // Step 5: Particles flow, Δ softly activates
      setTimeout(() => setStep(6), 2700), // Step 6: Comparison result reveals
      setTimeout(() => setStep(7), 3200), // Step 7: Sparkline draws
      setTimeout(() => setStep(8), 3500), // Step 8: Settled ambient state
    ]

    return () => timers.forEach(clearTimeout)
  }, [])

  // Desktop pointer interaction: subtle +/- 3px transform parallax
  useEffect(() => {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!isFinePointer || prefersReduced) return

    const handlePointerMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = Math.max(-3, Math.min(3, (e.clientX - centerX) * 0.012))
      const dy = Math.max(-3, Math.min(3, (e.clientY - centerY) * 0.012))
      setPointerOffset({ x: dx, y: dy })
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('pointermove', handlePointerMove, { passive: true })
    }
    return () => {
      if (container) {
        container.removeEventListener('pointermove', handlePointerMove)
      }
    }
  }, [])

  const isDark = theme === 'dark'

  return (
    <div
      ref={containerRef}
      className="w-full max-w-xl xl:max-w-2xl relative select-none"
      style={{
        transform: `translate3d(${pointerOffset.x}px, ${pointerOffset.y}px, 0)`,
        transition: 'transform 0.15s ease-out',
      }}
    >
      {/* Background Ambient Glow & Greek Delta Motif */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 flex items-center justify-center">
        <div className="w-96 h-96 rounded-full bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/15 blur-3xl transform -translate-y-6" />
        <div className="absolute text-stone-200/40 dark:text-[#5B3FE0]/5 font-black text-[200px] xl:text-[220px] select-none -translate-y-4">
          Δ
        </div>
      </div>

      {/* Visual Workflow Header Eyebrow */}
      <div className="text-center mb-2.5 sm:mb-3 space-y-0.5">
        <div className="inline-flex items-center space-x-2 px-2 py-0.5 rounded-full bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 border border-[#5B3FE0]/20 text-[#5B3FE0] dark:text-[#8266FA] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
          <span>Intelligence Pipeline</span>
          <span>•</span>
          <span>Automated Δ Comparison</span>
        </div>
        <h2 className="text-sm sm:text-base xl:text-lg font-black text-stone-800 dark:text-slate-100 tracking-tight">
          See What Changed Between Reports
        </h2>
      </div>

      {/* Twin Report Cards with Central Comparison Node & Connector Network */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2 lg:gap-2.5 xl:gap-3 relative z-10">
          {/* CARD 1: PREVIOUS REPORT */}
          <div
            className={`bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-xs border border-stone-200/90 dark:border-slate-800 rounded-2xl p-2 sm:p-2.5 xl:p-3 shadow-lg shadow-stone-200/50 dark:shadow-black/50 space-y-1.5 transition-all duration-500 ${
              step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800/80 pb-1">
              <div>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500 block">
                  1. Previous (Baseline)
                </span>
                <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-slate-200">
                  Jan 15, 2026
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400">
                HealthLab
              </span>
            </div>

            <div className="space-y-1 sm:space-y-1.5">
              {/* Row 1: Hemoglobin (Focus Target) */}
              <div
                id="hero-row-hemo-prev"
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all duration-300 flex items-center justify-between relative ${
                  step >= 3
                    ? 'bg-violet-50/90 dark:bg-[#5B3FE0]/20 border-[#5B3FE0]/40 shadow-xs'
                    : 'bg-stone-50/60 dark:bg-slate-900/60 border-transparent'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-stone-700 dark:text-slate-200 block">Hemoglobin</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">Ref: 13.0 – 17.0</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-mono font-black text-stone-900 dark:text-slate-100 block">13.8</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">g/dL</span>
                </div>
              </div>

              {/* Row 2: Vitamin D */}
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-stone-50/40 dark:bg-slate-900/40 border border-transparent flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-stone-600 dark:text-slate-300 block">Vitamin D</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">Ref: 20 – 50</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-mono font-bold text-stone-700 dark:text-slate-300 block">17</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">ng/mL</span>
                </div>
              </div>

              {/* Row 3: WBC */}
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-stone-50/40 dark:bg-slate-900/40 border border-transparent flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-stone-600 dark:text-slate-300 block">WBC Count</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">Ref: 4,000 – 11,000</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-mono font-bold text-stone-700 dark:text-slate-300 block">7,100</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">/µL</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTRAL LABΔ COMPARISON ENGINE NODE */}
          <div className="hidden md:flex flex-col items-center justify-center px-1 z-20">
            <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500 mb-0.5">
              COMPARE
            </div>
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-[#131B2E] border-2 border-[#5B3FE0] flex items-center justify-center transition-all duration-500 ${
                step >= 5
                  ? 'shadow-lg shadow-[#5B3FE0]/30 scale-105'
                  : 'scale-95 opacity-70 border-stone-300 dark:border-slate-700'
              } ${step >= 8 && !reducedMotion ? 'animate-pulse-subtle' : ''}`}
            >
              <span className="text-base sm:text-lg font-black text-[#5B3FE0] dark:text-[#8266FA] leading-none">
                Δ
              </span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#5B3FE0] dark:text-[#8266FA] mt-0.5 font-mono">
              ENGINE
            </div>
          </div>

          {/* CARD 2: CURRENT REPORT */}
          <div
            className={`bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-xs border border-stone-200/90 dark:border-slate-800 rounded-2xl p-2 sm:p-2.5 xl:p-3 shadow-lg shadow-stone-200/50 dark:shadow-black/50 space-y-1.5 transition-all duration-500 ${
              step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800/80 pb-1">
              <div>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-slate-500 block">
                  2. Current (Newer)
                </span>
                <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-slate-200">
                  Apr 15, 2026
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/60 text-[#5B3FE0] dark:text-[#8266FA] border border-violet-200/60 dark:border-violet-800/60">
                City Labs
              </span>
            </div>

            <div className="space-y-1 sm:space-y-1.5">
              {/* Row 1: Hemoglobin (Focus Target) */}
              <div
                id="hero-row-hemo-curr"
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all duration-300 flex items-center justify-between relative ${
                  step >= 3
                    ? 'bg-violet-50/90 dark:bg-[#5B3FE0]/20 border-[#5B3FE0]/40 shadow-xs'
                    : 'bg-stone-50/60 dark:bg-slate-900/60 border-transparent'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-stone-700 dark:text-slate-200 block">Hemoglobin</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">Ref: 13.0 – 17.0</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-mono font-black text-stone-900 dark:text-slate-100 block">12.8</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">g/dL</span>
                </div>
              </div>

              {/* Row 2: Vitamin D */}
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-stone-50/40 dark:bg-slate-900/40 border border-transparent flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-stone-600 dark:text-slate-300 block">Vitamin D</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">Ref: 20 – 50</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-mono font-bold text-stone-700 dark:text-slate-300 block">21</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">ng/mL</span>
                </div>
              </div>

              {/* Row 3: WBC */}
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-stone-50/40 dark:bg-slate-900/40 border border-transparent flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-stone-600 dark:text-slate-300 block">WBC Count</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">Ref: 4,000 – 11,000</span>
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-mono font-bold text-stone-700 dark:text-slate-300 block">7,300</span>
                  <span className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500 font-mono">/µL</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SVG DATA CONNECTOR OVERLAY WITH TRAVELLING PARTICLES */}
        <div className="hidden md:block absolute inset-0 pointer-events-none z-[15]" aria-hidden="true">
          <svg className="w-full h-full" viewBox="0 0 600 240" preserveAspectRatio="none">
            {/* Left connector path (Hemoglobin row to Delta Node) */}
            <path
              d="M 230,96 C 265,96 270,120 286,120"
              fill="none"
              stroke={isDark ? '#8266FA' : '#5B3FE0'}
              strokeWidth="1.5"
              strokeDasharray={step >= 4 ? 'none' : '4 4'}
              opacity={step >= 4 ? 0.75 : 0.25}
              className="transition-opacity duration-500"
            />
            {/* Right connector path (Delta Node to Hemoglobin row) */}
            <path
              d="M 370,96 C 335,96 330,120 314,120"
              fill="none"
              stroke={isDark ? '#8266FA' : '#5B3FE0'}
              strokeWidth="1.5"
              strokeDasharray={step >= 4 ? 'none' : '4 4'}
              opacity={step >= 4 ? 0.75 : 0.25}
              className="transition-opacity duration-500"
            />

            {/* Subtle secondary connector paths for Vitamin D and WBC */}
            <path
              d="M 230,154 C 265,154 275,130 286,125"
              fill="none"
              stroke={isDark ? '#64748B' : '#94A3B8'}
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity={step >= 4 ? 0.4 : 0.1}
            />
            <path
              d="M 370,154 C 335,154 325,130 314,125"
              fill="none"
              stroke={isDark ? '#64748B' : '#94A3B8'}
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity={step >= 4 ? 0.4 : 0.1}
            />

            {/* Moving Data Particles (Active during flow and settled ambient state) */}
            {step >= 5 && !reducedMotion && (
              <>
                {/* Left particle moving from Jan Hemoglobin to Delta */}
                <circle r="3" fill={isDark ? '#8266FA' : '#5B3FE0'} opacity="0.9">
                  <animateMotion
                    key={`p-left-${step >= 8 ? 'settled' : 'active'}`}
                    path="M 230,96 C 265,96 270,120 286,120"
                    dur={step >= 8 ? '4.2s' : '1.8s'}
                    repeatCount="indefinite"
                    begin="0s"
                  />
                </circle>

                {/* Right particle moving from Apr Hemoglobin to Delta */}
                <circle r="3" fill={isDark ? '#8266FA' : '#5B3FE0'} opacity="0.9">
                  <animateMotion
                    key={`p-right-${step >= 8 ? 'settled' : 'active'}`}
                    path="M 370,96 C 335,96 330,120 314,120"
                    dur={step >= 8 ? '4.2s' : '1.8s'}
                    repeatCount="indefinite"
                    begin="0.2s"
                  />
                </circle>

                {/* Second subtle particle during active initial sequence */}
                {step >= 5 && step < 8 && (
                  <circle r="2.5" fill={isDark ? '#8266FA' : '#5B3FE0'} opacity="0.65">
                    <animateMotion
                      key="p-subtle-active"
                      path="M 230,96 C 265,96 270,120 286,120"
                      dur="1.8s"
                      repeatCount="indefinite"
                      begin="0.9s"
                    />
                  </circle>
                )}
              </>
            )}
          </svg>
        </div>
      </div>

      {/* REVEAL BRIDGE: COMPUTED DELTA & SPARKLINE RESULT */}
      <div
        className={`mt-2 sm:mt-2.5 bg-gradient-to-r from-violet-50/90 via-white to-stone-50/90 dark:from-[#131B2E] dark:via-[#162038] dark:to-[#0F172A] border border-[#5B3FE0]/30 dark:border-slate-800 rounded-2xl p-2 sm:p-2.5 xl:p-3 shadow-lg shadow-[#5B3FE0]/5 transition-all duration-500 ${
          step >= 6 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          {/* Delta calculation */}
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                Matched: <span className="text-stone-900 dark:text-slate-100 font-black">Hemoglobin</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/70 text-[#5B3FE0] dark:text-[#8266FA]">
                CHANGED
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <div className="text-base sm:text-lg xl:text-xl font-black font-mono text-[#5B3FE0] dark:text-[#8266FA] tracking-tight">
                Δ −1.0 <span className="text-xs sm:text-sm font-semibold text-stone-400 dark:text-slate-500">g/dL</span>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold text-stone-600 dark:text-slate-400">
                ↓ −7.2%
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-stone-400 dark:text-slate-500">
              Shift from 13.8 g/dL (Jan) to 12.8 g/dL (Apr)
            </p>
          </div>

          {/* Animated Mini Trend Sparkline */}
          <div className="w-full sm:w-36 xl:w-40 h-8 sm:h-9 flex flex-col justify-end">
            <span className="text-[9px] font-bold uppercase text-stone-400 dark:text-slate-500 tracking-wider text-right mb-0.5 block">
              Trajectory
            </span>
            <svg viewBox="0 0 160 40" className="w-full h-5 sm:h-6 overflow-visible">
              {/* Baseline reference dash */}
              <line
                x1="0"
                y1="20"
                x2="160"
                y2="20"
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-stone-300 dark:text-slate-700"
                strokeWidth="1"
              />
              {/* Trend line - linear data connection */}
              <path
                d="M 10 12 L 60 14 L 110 24 L 150 28"
                fill="none"
                stroke="#5B3FE0"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-700"
                style={{
                  strokeDasharray: 200,
                  strokeDashoffset: step >= 7 ? 0 : 200,
                  transition: 'stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
              {/* Point 1 */}
              <circle
                cx="10"
                cy="12"
                r="3.5"
                className={`fill-[#5B3FE0] transition-opacity duration-300 ${step >= 7 ? 'opacity-100' : 'opacity-0'}`}
              />
              {/* Point 2 */}
              <circle
                cx="150"
                cy="28"
                r="4.5"
                className={`fill-[#5B3FE0] stroke-2 stroke-white dark:stroke-[#131B2E] transition-opacity duration-500 ${step >= 7 ? 'opacity-100' : 'opacity-0'}`}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact Mobile Banner for <= 640px devices
export function CompactAuthHero() {
  return (
    <div className="w-full max-w-sm sm:max-w-md bg-stone-50 dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-2.5 mb-2.5 shadow-2xs select-none">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 font-medium text-stone-600 dark:text-slate-300">
          <span className="font-bold text-[#5B3FE0]">LabΔ:</span>
          <span>Jan (13.8)</span>
          <span className="text-stone-400">→</span>
          <span className="font-bold text-[#5B3FE0]">Δ</span>
          <span className="text-stone-400">→</span>
          <span>Apr (12.8)</span>
        </div>
        <div className="flex items-center space-x-1 font-mono font-bold text-[#5B3FE0] dark:text-[#8266FA] bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 px-2 py-0.5 rounded">
          <span>Δ −1.0</span>
          <span className="text-[10px] text-stone-500 dark:text-slate-400 font-normal">(−7.2%)</span>
        </div>
      </div>
    </div>
  )
}
