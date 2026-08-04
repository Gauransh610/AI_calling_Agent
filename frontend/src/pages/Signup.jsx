import { useState } from 'react'
import { api, setToken } from '../api'

export default function Signup({ onNavigate, onAuthed, showToast }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const data = await api.signup({ name, email, password })
      setToken(data.token)
      onAuthed(data.user)
      showToast(`Welcome, ${data.user.name.split(' ')[0]}! Your account is ready.`)
      onNavigate('dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div onClick={() => onNavigate('landing')} style={{ fontSize: 13, color: '#a1a1aa', cursor: 'pointer', marginBottom: 32 }}>← Back to home</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto', background: 'linear-gradient(135deg,#a855f7,#22d3ee)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📞</div>
          <h1 style={{ fontSize: 32, fontWeight: 600, marginTop: 20, color: '#fff' }}>Create your free account</h1>
          <p style={{ color: '#a1a1aa', marginTop: 8 }}>Start calling with local AI today. No credit card required.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass card" style={{ marginTop: 36, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>FULL NAME</label>
            <input className="input-field" style={{ marginTop: 6 }} required value={name} onChange={e => setName(e.target.value)} placeholder="Alex Rivera" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>EMAIL</label>
            <input className="input-field" style={{ marginTop: 6 }} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>PASSWORD</label>
            <input className="input-field" style={{ marginTop: 6 }} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}

          <button className="btn-primary" style={{ height: 48, border: 'none' }} disabled={loading}>
            {loading ? 'Creating account…' : 'Create free account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#a1a1aa' }}>
          Already have an account? <span style={{ color: '#67e8f9', cursor: 'pointer' }} onClick={() => onNavigate('login')}>Log in</span>
        </div>
      </div>
    </div>
  )
}
