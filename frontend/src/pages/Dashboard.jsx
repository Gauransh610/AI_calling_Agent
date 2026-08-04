import { useEffect, useState } from 'react'
import { api } from '../api'
import CallModal from '../components/CallModal'

export default function Dashboard({ user, showToast }) {
  const [stats, setStats] = useState(null)
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [statsRes, callsRes] = await Promise.all([api.stats(), api.calls()])
      setStats(statsRes.stats)
      setCalls(callsRes.calls)
    } catch (err) {
      showToast(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const statCards = stats ? [
    ['Total calls', stats.totalCalls],
    ['Success rate', `${stats.successRate}%`],
    ['Avg duration', `${stats.avgDurationMinutes}m`],
    ['Storage used', `${stats.storageUsedMb} MB`]
  ] : []

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 32px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 600, color: '#fff', margin: 0 }}>Welcome back, {user.name.split(' ')[0]}</h1>
          <p style={{ color: '#a1a1aa', marginTop: 6 }}>Here's what your agent has been up to.</p>
        </div>
        <button className="btn-primary" style={{ padding: '12px 24px', border: 'none', fontSize: 14 }} onClick={() => setShowModal(true)}>
          📞 Start new call
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {statCards.map(([label, value]) => (
          <div key={label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: '#a1a1aa' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Recent calls</div>

        {loading && <div style={{ color: '#a1a1aa', fontSize: 13 }}>Loading…</div>}
        {!loading && calls.length === 0 && (
          <div style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
            No calls yet — start one to see it show up here.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {calls.map(call => (
            <div key={call.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 8px', borderBottom: '1px solid #27272a'
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{call.contact}</div>
                <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{call.summary || 'No summary'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={call.status} />
                <div style={{ color: '#71717a', fontSize: 11, marginTop: 4 }}>
                  {Math.round(call.durationSeconds / 60)}m {call.durationSeconds % 60}s • {new Date(call.startedAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <CallModal
          onClose={() => setShowModal(false)}
          onSaved={loadData}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    completed: { bg: 'rgba(52,211,153,.15)', color: '#34d399' },
    voicemail: { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
    missed: { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
    failed: { bg: 'rgba(248,113,113,.15)', color: '#f87171' }
  }
  const c = colors[status] || colors.completed
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>
      {status}
    </span>
  )
}
