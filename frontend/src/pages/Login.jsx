import { useState } from 'react'
import { api, setToken } from '../api'

export default function Login({ onNavigate, onAuthed, showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login({ email, password })
      setToken(data.token)
      onAuthed(data.user)
      showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`)
      onNavigate('dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div onClick={() => onNavigate('landing')} style={{ fontSize: 13, color: '#a1a1aa', cursor: 'pointer', marginBottom: 32 }}>← Back to home</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto', background: 'linear-gradient(135deg,#a855f7,#22d3ee)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📞</div>
          <h1 className="auth-title" style={{ fontSize: 32, fontWeight: 600, marginTop: 20, color: '#fff' }}>Welcome back</h1>
          <p style={{ color: '#a1a1aa', marginTop: 8 }}>Log in to see your call history.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass card auth-form" style={{ marginTop: 36, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>EMAIL</label>
            <input className="input-field" style={{ marginTop: 6 }} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>PASSWORD</label>
            <input className="input-field" style={{ marginTop: 6 }} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}

          <button className="btn-primary" style={{ height: 48, border: 'none' }} disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>

        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#a1a1aa' }}>
          No account? <span style={{ color: '#67e8f9', cursor: 'pointer' }} onClick={() => onNavigate('signup')}>Sign up free</span>
        </div>
      </div>
    </div>
  )
}
