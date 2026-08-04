export default function Navbar({ user, onNavigate, onLogout }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: '#09090b', borderBottom: '1px solid #27272a'
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => onNavigate('landing')} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, background: '#22d3ee', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📞</div>
          <div className="logo-font" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-1px' }}>
            <span className="gradient-text">neura</span><span style={{ color: '#fff' }}>Call</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user ? (
            <>
              <button className="btn-outline" style={{ padding: '10px 22px', fontSize: 14, fontWeight: 600 }} onClick={() => onNavigate('dashboard')}>
                Dashboard
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: '#c084fc', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                  {user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#a1a1aa' }}>{user.name}</div>
              </div>
              <button className="btn-outline" style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600 }} onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button className="btn-outline" style={{ padding: '10px 22px', fontSize: 14, fontWeight: 600 }} onClick={() => onNavigate('login')}>
                Log in
              </button>
              <button className="btn-primary" style={{ padding: '10px 22px', fontSize: 14, border: 'none' }} onClick={() => onNavigate('signup')}>
                Get started free
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
