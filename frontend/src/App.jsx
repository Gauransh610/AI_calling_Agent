import { useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Toast from './components/Toast'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import { api, getToken, setToken } from './api'
import { useIdleLogout, isSessionStale, touchActivity } from './hooks/useIdleLogout'

export default function App() {
  const [page, setPage] = useState('landing')
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [toast, setToastMsg] = useState('')
  const loggingOutRef = useRef(false)

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3200)
  }

  useEffect(() => {
    async function restoreSession() {
      if (getToken()) {
        if (isSessionStale()) {
         
          setToken(null)
          showToast('Your session expired. Please log in again.')
        } else {
          try {
            const { user } = await api.me()
            setUser(user)
            setPage('dashboard')
          } catch {
            setToken(null)
          }
        }
      }
      setCheckingAuth(false)
    }
    restoreSession()
  }, [])

  
  async function endSession({ message, nextPage, callServer = true }) {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    if (callServer) {
      try { await api.logout() } catch { }
    }
    setToken(null)
    setUser(null)
    setPage(nextPage)
    showToast(message)
    loggingOutRef.current = false
  }

  function handleLogout() {
    return endSession({ message: 'Logged out', nextPage: 'landing' })
  }

  const idleSecondsLeft = useIdleLogout({
    enabled: Boolean(user),
    onIdle: () => endSession({
      message: 'You were logged out because of inactivity. Please log in again.',
      nextPage: 'login'
    }),
    onExpired: () => endSession({
      message: 'Your session expired. Please log in again.',
      nextPage: 'login',
      callServer: false
    })
  })

  function handleNavigate(target) {
    if (target === 'dashboard' && !user) {
      setPage('login')
      return
    }
    setPage(target)
  }

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>Loading…</div>
  }

  return (
    <div>
      <Navbar user={user} onNavigate={handleNavigate} onLogout={handleLogout} />

      {page === 'landing' && <Landing onNavigate={handleNavigate} />}
      {page === 'login' && <Login onNavigate={handleNavigate} onAuthed={setUser} showToast={showToast} />}
      {page === 'signup' && <Signup onNavigate={handleNavigate} onAuthed={setUser} showToast={showToast} />}
      {page === 'dashboard' && user && <Dashboard user={user} showToast={showToast} />}

      {user && idleSecondsLeft !== null && (
        <div role="alert" style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
          width: 'calc(100% - 24px)', maxWidth: 420, background: '#18181b', border: '1px solid #f59e0b',
          color: '#fde68a', borderRadius: 16, padding: '12px 16px', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,.5)'
        }}>
          <span>Logging you out in <strong>{idleSecondsLeft}s</strong> due to inactivity.</span>
          <button
            onClick={touchActivity}
            style={{
              background: '#f59e0b', color: '#18181b', border: 'none', borderRadius: 999,
              padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            Stay logged in
          </button>
        </div>
      )}

      <Toast message={toast} />
    </div>
  )
}
