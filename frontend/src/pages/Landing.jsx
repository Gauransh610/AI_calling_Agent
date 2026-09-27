export default function Landing({ onNavigate }) {
  return (
    <div>
      <header className="hero-bg hero-header" style={{ paddingTop: 140, paddingBottom: 100 }}>
        <div className="hero-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 760, textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.2)', padding: '6px 18px', borderRadius: 999, fontSize: 12,
              fontWeight: 500, letterSpacing: 1, marginBottom: 24
            }}>
              <div className="pulse-dot" style={{ width: 8, height: 8, background: '#34d399', borderRadius: 999 }} />
              POWERED BY OLLAMA • 100% LOCAL
            </div>

            <h1 className="logo-font hero-title" style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-2px', color: '#fff', margin: 0 }}>
              Your AI calling<br />agent that <span className="gradient-text">actually</span><br />speaks like you
            </h1>

            <p style={{ marginTop: 28, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto', fontSize: 19, color: '#a1a1aa', lineHeight: 1.6 }}>
              Run real voice conversations with a local LLM, right in your browser.
              No paid APIs. No subscriptions. Just Ollama, your microphone, and full privacy.
            </p>

            <div style={{ display: 'flex', gap: 16, marginTop: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ height: 54, padding: '0 36px', fontSize: 16, border: 'none', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => onNavigate('signup')}>
                ⚡ Get started for free
              </button>
              <button className="btn-outline" style={{ height: 54, padding: '0 30px', fontSize: 15, fontWeight: 500 }} onClick={() => onNavigate('login')}>
                Log in
              </button>
            </div>

            <div style={{ marginTop: 60, display: 'flex', gap: 24, fontSize: 12, color: '#71717a', justifyContent: 'center', flexWrap: 'wrap' }}>
              RUNS ON YOUR MACHINE • <span style={{ color: '#67e8f9', fontFamily: 'monospace' }}>OLLAMA • WEB SPEECH API</span>
            </div>
          </div>
        </div>
      </header>

      <section className="steps-section" style={{ maxWidth: 1400, margin: '0 auto', padding: '80px 32px' }}>
        <h2 className="logo-font" style={{ fontSize: 36, color: '#fff', textAlign: 'center', marginBottom: 50 }}>How it works</h2>
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            ['1', 'Sign up free', 'Create an account — no credit card required.'],
            ['2', 'Pick your agent', 'Choose personality and how it should respond.'],
            ['3', 'Start a call', 'Talk to it live using your microphone.'],
            ['4', 'Review the log', 'Every call is transcribed and saved to your dashboard.']
          ].map(([n, title, desc]) => (
            <div key={n} className="card" style={{ padding: 28, position: 'relative' }}>
              <div style={{ background: '#67e8f9', color: '#09090b', fontFamily: 'monospace', fontSize: 26, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, fontWeight: 700 }}>{n}</div>
              <div style={{ marginTop: 24, color: '#fff', fontWeight: 500 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 8 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ padding: '50px 32px', textAlign: 'center', color: '#71717a', fontSize: 12 }}>
        Built as a portfolio project • Free & local • © 2026 neuraLabs
      </footer>
    </div>
  )
}
