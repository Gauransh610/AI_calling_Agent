import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api'


export const IDLE_TIMEOUT_MS = 3 * 60 * 1000   
export const WARNING_MS = 30 * 1000            
// ────────────────────────────────────────────────────────────────────────────

const HEARTBEAT_MS = 60 * 1000                 
const ACTIVITY_KEY = 'neuracall_last_activity' 
export const ACTIVITY_EVENT = 'neuracall:activity'

const DOM_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll', 'wheel', 'click']

function readLastActivity() {
  try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0 } catch { return 0 }
}

function writeLastActivity(ts) {
  try { localStorage.setItem(ACTIVITY_KEY, String(ts)) } catch {}
}


export function touchActivity() {
  writeLastActivity(Date.now())
}

/** True if a saved login has been idle longer than the limit (e.g. tab was closed for a while). */
export function isSessionStale() {
  const last = readLastActivity()
  return !last || Date.now() - last >= IDLE_TIMEOUT_MS
}


export function useIdleLogout({ enabled, onIdle, onExpired }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const onIdleRef = useRef(onIdle)
  const onExpiredRef = useRef(onExpired)

  useEffect(() => {
    onIdleRef.current = onIdle
    onExpiredRef.current = onExpired
  })

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(null)
      return undefined
    }

    let finished = false
    let lastWrite = 0
    let lastPing = Date.now()
    writeLastActivity(Date.now())

    
    function check() {
      if (finished) return
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - readLastActivity())
      if (remaining <= 0) {
        finished = true
        setSecondsLeft(null)
        onIdleRef.current?.()
        return
      }
      setSecondsLeft(remaining <= WARNING_MS ? Math.ceil(remaining / 1000) : null)
    }

    function markActive() {
      if (finished) return
      const now = Date.now()
     
      if (now - readLastActivity() >= IDLE_TIMEOUT_MS) {
        check()
        return
      }
      if (now - lastWrite < 1000) return 
      lastWrite = now
      writeLastActivity(now)
    }

    
    async function heartbeat() {
      if (finished || readLastActivity() <= lastPing) return
      lastPing = Date.now()
      try {
        const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${getToken()}` } })
        if (res.status === 401 && !finished) {
          finished = true
          setSecondsLeft(null)
          onExpiredRef.current?.()
        }
      } catch {
        
      }
    }

    function onVisible() {
      if (!document.hidden) check()
    }

    DOM_ACTIVITY_EVENTS.forEach(name =>
      window.addEventListener(name, markActive, { passive: true, capture: true })
    )
    window.addEventListener(ACTIVITY_EVENT, markActive)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)

    const checkTimer = setInterval(check, 1000)
    const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS)

    return () => {
      finished = true
      DOM_ACTIVITY_EVENTS.forEach(name =>
        window.removeEventListener(name, markActive, { capture: true })
      )
      window.removeEventListener(ACTIVITY_EVENT, markActive)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      clearInterval(checkTimer)
      clearInterval(heartbeatTimer)
    }
  }, [enabled])

  return secondsLeft
}