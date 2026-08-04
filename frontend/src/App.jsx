import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Toast from './components/Toast'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import { api, getToken, setToken } from './api'

export default function App() {
  const [page, setPage] = useState('landing')
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [toast, setToastMsg] = useState('')

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3200)
  }

  useEffect(() => {
    async function restoreSession() {
      if (getToken()) {
        try {
          const { user } = await api.me()
          setUser(user)
          setPage('dashboard')
        } catch {
          setToken(null)
        }
      }
      setCheckingAuth(false)
    }
    restoreSession()
  }, [])

  async function handleLogout() {
    try { await api.logout() } catch { /* ignore */ }
    setToken(null)
    setUser(null)
    setPage('landing')
    showToast('Logged out')
  }

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

      <Toast message={toast} />
    </div>
  )
}
