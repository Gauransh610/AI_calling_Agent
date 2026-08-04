export default function Toast({ message }) {
  if (!message) return null
  return (
    <div className="toast" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#18181b', border: '1px solid #3f3f46', color: '#e4e4e7',
      padding: '12px 20px', borderRadius: 999, fontSize: 14, zIndex: 100,
      boxShadow: '0 20px 40px rgba(0,0,0,.4)'
    }}>
      {message}
    </div>
  )
}
