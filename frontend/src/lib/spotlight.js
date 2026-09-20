/**
 * LabΔ Spotlight Pointer Helper
 * Updates CSS custom properties directly on the element style without triggering React re-renders.
 */
export function handleSpotlightMouseMove(e) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  e.currentTarget.style.setProperty('--mouse-x', `${x}px`)
  e.currentTarget.style.setProperty('--mouse-y', `${y}px`)
}
