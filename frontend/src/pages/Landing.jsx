export default function Landing({ onNavigate }) {
  return (
    <div>
      <header className="hero-bg" style={{ paddingTop: 140, paddingBottom: 100 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.2)', padding: '6px 18px', borderRadius: 999, fontSize: 12,
              fontWeight: 500, letterSpacing: 1, marginBottom: 24
            }}>
              <div className="pulse-dot" style={{ width: 8, height: 8, background: '#34d399', borderRadius: 999 }} />
              POWERED BY OLLAMA • 100% LOCAL
            </div>

            <h1 className="logo-font" style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-2px', color: '#fff', margin: 0 }}>
              Your AI calling<br />agent that <span className="gradient-text">actually</span><br />speaks like you
            </h1>

            <p style={{ marginTop: 28, maxWidth: 480, fontSize: 19, color: '#a1a1aa', lineHeight: 1.6 }}>
              Run real voice conversations with a local LLM, right in your browser.
              No paid APIs. No subscriptions. Just Ollama, your microphone, and full privacy.
            </p>

            <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
              <button className="btn-primary" style={{ height: 54, padding: '0 36px', fontSize: 16, border: 'none', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => onNavigate('signup')}>
                ⚡ Get started for free
              </button>
              <button className="btn-outline" style={{ height: 54, padding: '0 30px', fontSize: 15, fontWeight: 500 }} onClick={() => onNavigate('login')}>
                Log in
              </button>
            </div>

            <div style={{ marginTop: 60, display: 'flex', gap: 24, fontSize: 12, color: '#71717a' }}>
              RUNS ON YOUR MACHINE • <span style={{ color: '#67e8f9', fontFamily: 'monospace' }}>OLLAMA • WEB SPEECH API</span>
            </div>
          </div>

          <div style={{ justifySelf: 'center', width: 280, border: '10px solid #27272a', borderRadius: 44, background: '#18181b', padding: 10, boxShadow: '0 25px 60px rgba(0,0,0,.6)' }}>
            <div style={{ background: '#0a0a0c', borderRadius: 32, height: 500, position: 'relative', overflow: 'hidden', border: '1px solid #27272a' }}>
              <div style={{ height: 40, background: '#000', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontSize: 10, fontFamily: 'monospace', color: '#a1a1aa', paddingBottom: 6 }}>
                9:41 • neuraCall
              </div>
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, margin: '0 auto', background: 'linear-gradient(135deg,#c084fc,#22d3ee)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>👩‍💼</div>
                <div style={{ marginTop: 14, fontWeight: 500, color: '#fff' }}>Sarah Patel</div>
                <div style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }}>● LIVE AI CALL</div>

                <div style={{ marginTop: 30, height: 220, background: '#000', borderRadius: 20, padding: 16, textAlign: 'left', fontSize: 11, border: '1px solid #27272a' }}>
                  <div style={{ color: '#a1a1aa', fontSize: 9 }}>Agent • just now</div>
                  <div style={{ color: '#fff', marginBottom: 14 }}>Hi Sarah, this is your AI assistant — how can I help schedule your appointment?</div>
                  <div style={{ color: '#a1a1aa', fontSize: 9, textAlign: 'right' }}>Sarah • just now</div>
                  <div style={{ color: '#fde68a', textAlign: 'right' }}>Can we move it to Thursday?</div>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                <div className="wave" style={{ width: 5, height: 24, background: '#22d3ee', borderRadius: 4, animationDelay: '0ms' }} />
                <div className="wave" style={{ width: 5, height: 32, background: '#22d3ee', borderRadius: 4, animationDelay: '200ms' }} />
                <div className="wave" style={{ width: 5, height: 18, background: '#22d3ee', borderRadius: 4, animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section style={{ maxWidth: 1400, margin: '0 auto', padding: '80px 32px' }}>
        <h2 className="logo-font" style={{ fontSize: 36, color: '#fff', textAlign: 'center', marginBottom: 50 }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
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

      <section style={{ background: '#000', padding: '70px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', fontStyle: 'italic', fontSize: 22, color: '#d4d4d8' }}>
          "I replaced my $800/month AI phone service with this. Runs on my old MacBook and it just works."
        </div>
        <div style={{ marginTop: 24, color: '#fff', fontWeight: 500 }}>Priya Sharma</div>
        <div style={{ fontSize: 12, color: '#a1a1aa' }}>Founder @ LocalMed AI</div>
      </section>

      <footer style={{ padding: '50px 32px', textAlign: 'center', color: '#71717a', fontSize: 12 }}>
        Built as a portfolio project • Free & local • © 2026 neuraLabs
      </footer>
    </div>
  )
}
