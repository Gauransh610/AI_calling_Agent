import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

const SpeechRecognitionImpl = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

const RECOGNITION_ERRORS = {
  'not-allowed': 'Microphone is blocked. Tap the lock icon next to the address bar → Permissions → allow Microphone, then reload and try again.',
  'service-not-allowed': 'Speech recognition is blocked on this device. Check Chrome microphone permission and that "Google" voice typing is enabled in Android settings.',
  'audio-capture': 'No microphone found, or another app is using it. Close other apps using the mic and try again.',
  'network': 'Speech recognition needs an internet connection. Check your network and try again.',
  'language-not-supported': 'This language is not supported for speech recognition on this device.',
  'no-speech': "I didn't hear anything. Tap the mic and speak right after it starts listening."
}


function splitIntoChunks(text, max = 180) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text]
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    if ((current + sentence).length > max && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export default function CallModal({ onClose, onSaved, showToast }) {
  const [contact, setContact] = useState('New Contact')
  const [transcript, setTranscript] = useState([])
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [interim, setInterim] = useState('')
  const [notice, setNotice] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [startedAt] = useState(() => new Date())

  const recognitionRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const transcriptRef = useRef([])        // always-fresh copy for async callbacks
  const contactRef = useRef(contact)
  const startTimerRef = useRef(null)

  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { contactRef.current = contact }, [contact])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, thinking, interim])

  useEffect(() => {
    
    window.speechSynthesis?.getVoices()
    speak("Hi! I'm your AI calling agent. Tap the mic and say hello to start the conversation.")

    return () => {
      clearTimeout(startTimerRef.current)
      detachAndStopRecognition()
      window.speechSynthesis?.cancel()
    }
    
  }, [])

  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || []
    return voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang?.startsWith('en')) || null
  }

  function speak(text) {
    const synth = window.speechSynthesis
    if (!synth || !text) return
    synth.cancel()

    const chunks = splitIntoChunks(text)
    const voice = pickVoice()

    chunks.forEach((chunk, index) => {
      const utter = new SpeechSynthesisUtterance(chunk)
      utter.lang = 'en-US'
      utter.rate = 1
      if (voice) utter.voice = voice
      if (index === 0) utter.onstart = () => setSpeaking(true)
      if (index === chunks.length - 1) {
        utter.onend = () => setSpeaking(false)
        utter.onerror = () => setSpeaking(false)
      }
      synth.speak(utter)
    })
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  function detachAndStopRecognition() {
    const rec = recognitionRef.current
    if (!rec) return
    rec.onresult = null
    rec.onend = null
    rec.onerror = null
    try { rec.abort() } catch {}
    recognitionRef.current = null
  }

  function stopRecognition() {
    try { recognitionRef.current?.stop() } catch {}
  }

  async function sendMessage(text) {
    const clean = text.trim()
    if (!clean) return

    const contactEntry = { speaker: 'contact', text: clean, at: new Date().toISOString() }
    const historyBefore = transcriptRef.current
    setTranscript(prev => [...prev, contactEntry])
    setThinking(true)

    try {
      const { reply } = await api.agentReply({
        contact: contactRef.current,
        message: clean,
        history: historyBefore
      })
      const agentEntry = { speaker: 'agent', text: reply, at: new Date().toISOString() }
      setTranscript(prev => [...prev, agentEntry])
      speak(reply)
    } catch (err) {
      setNotice(err.message || 'Could not reach the AI. Please try again.')
    } finally {
      setThinking(false)
    }
  }

  function startRecognition() {
    const recognition = new SpeechRecognitionImpl()
    recognition.lang = 'en-US'
    recognition.interimResults = true   
    recognition.maxAlternatives = 1

    let finalText = ''
    let lastInterim = ''
    let failed = false

    recognition.onresult = (event) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      lastInterim = interimText
      setInterim(interimText || finalText)
    }

    recognition.onerror = (event) => {
      failed = true
      setListening(false)
      setInterim('')
      
      if (event.error !== 'aborted') {
        setNotice(RECOGNITION_ERRORS[event.error] || `Microphone error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      setListening(false)
      setInterim('')
      recognitionRef.current = null
      if (failed) return
      
      const spoken = (finalText || lastInterim).trim()
      if (spoken) sendMessage(spoken)
      else setNotice(RECOGNITION_ERRORS['no-speech'])
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      setListening(false)
      setNotice('Could not start the microphone. Please tap again.')
    }
  }

  function toggleListening() {
    if (!SpeechRecognitionImpl) {
      setNotice('Speech recognition is not supported in this browser. Use Chrome, or type in the box below.')
      return
    }

    if (listening) {
      stopRecognition()
      return
    }

    setNotice('')

    
    stopSpeaking()
    detachAndStopRecognition()

    clearTimeout(startTimerRef.current)
    startTimerRef.current = setTimeout(async () => {
      
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          
          stream.getTracks().forEach(t => t.stop())
        } catch (err) {
          const name = err?.name || ''
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            setNotice(RECOGNITION_ERRORS['not-allowed'])
          } else if (name === 'NotFoundError' || name === 'NotReadableError') {
            setNotice(RECOGNITION_ERRORS['audio-capture'])
          } else {
            setNotice(`Microphone error: ${name || 'unknown'}`)
          }
          return
        }
        await new Promise(r => setTimeout(r, 150))
      }
      startRecognition()
    }, 250)
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    stopSpeaking()
    sendMessage(manualInput)
    setManualInput('')
  }

  async function endCall() {
    clearTimeout(startTimerRef.current)
    detachAndStopRecognition()
    window.speechSynthesis?.cancel()

    const endedAt = new Date()
    const durationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000))
    const finalTranscript = transcriptRef.current

    try {
      await api.createCall({
        contact,
        status: finalTranscript.length ? 'completed' : 'missed',
        durationSeconds,
        transcript: finalTranscript,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString()
      })
      showToast('Call ended. Saved to your call history.')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Could not save the call')
    }
    onClose()
  }

  const micLabel = listening
    ? '🎙️ Listening… tap to stop'
    : thinking
      ? '⏳ Agent is thinking…'
      : speaking
        ? '🔊 Agent speaking… tap to interrupt & talk'
        : '🎙️ Tap to speak'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      overflowY: 'auto'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: 480, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        maxHeight: '100dvh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            value={contact}
            onChange={e => setContact(e.target.value)}
            className="input-field"
            style={{ fontWeight: 600, fontSize: 16, border: 'none', background: 'transparent', padding: '4px 0' }}
          />
          <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>● LIVE</span>
        </div>

        <div style={{
          background: '#09090b', border: '1px solid #27272a', borderRadius: 18, padding: 16,
          height: 'min(280px, 32dvh)', minHeight: 140, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 14
        }}>
          {transcript.length === 0 && !interim && (
            <div style={{ color: '#71717a', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
              Press the mic and say something to start talking.
            </div>
          )}
          {transcript.map((entry, i) => (
            <div key={i} style={{ alignSelf: entry.speaker === 'agent' ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
              <div style={{ fontSize: 10, color: '#71717a', textAlign: entry.speaker === 'agent' ? 'left' : 'right' }}>
                {entry.speaker === 'agent' ? 'Agent' : contact}
              </div>
              <div style={{ color: entry.speaker === 'agent' ? '#fff' : '#fde68a', fontSize: 13, textAlign: entry.speaker === 'agent' ? 'left' : 'right' }}>
                {entry.text}
              </div>
            </div>
          ))}
          {interim && (
            <div style={{ alignSelf: 'flex-end', maxWidth: '85%', color: '#a1a1aa', fontSize: 13, fontStyle: 'italic', textAlign: 'right' }}>
              {interim}…
            </div>
          )}
          {thinking && <div style={{ color: '#67e8f9', fontSize: 12 }}>Agent is thinking…</div>}
          <div ref={transcriptEndRef} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, minHeight: 20 }}>
          {listening && [0, 1, 2].map(i => (
            <div key={i} className="wave" style={{ width: 5, height: 20, background: '#22d3ee', borderRadius: 4, animationDelay: `${i * 150}ms` }} />
          ))}
        </div>

        {notice && (
          <div role="alert" style={{
            background: '#3f1d1d', border: '1px solid #7f1d1d', color: '#fecaca',
            borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.4
          }}>
            {notice}
          </div>
        )}

        <button
          onClick={toggleListening}
          disabled={thinking}
          className="btn-outline"
          style={{
            height: 52, borderRadius: 999, fontWeight: 600, fontSize: 14,
            touchAction: 'manipulation',
            opacity: thinking ? 0.6 : 1,
            borderColor: listening ? '#22d3ee' : '#3f3f46', color: listening ? '#22d3ee' : '#e4e4e7'
          }}
        >
          {micLabel}
        </button>

        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input-field"
            style={{ fontSize: 16 }}
            placeholder="…or type instead of speaking"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
          />
          <button className="btn-outline" style={{ padding: '0 18px' }}>Send</button>
        </form>

        <button onClick={endCall} style={{
          height: 48, borderRadius: 999, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 600,
          touchAction: 'manipulation'
        }}>
          📞 End call & save
        </button>
      </div>
    </div>
  )
}
