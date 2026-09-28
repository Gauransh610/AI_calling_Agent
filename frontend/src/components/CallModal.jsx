import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export default function CallModal({ onClose, onSaved, showToast }) {
  const [contact, setContact] = useState('New Contact')
  const [transcript, setTranscript] = useState([])
  const [listening, setListening] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [startedAt] = useState(() => new Date())

  const recognitionRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const manualInputRef = useRef(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, thinking])

  useEffect(() => {
    speak("Hi! I'm your AI calling agent. Say hello to start the conversation.")

    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        
      }

      window.speechSynthesis?.cancel()
    }

    
  }, [])

  function speak(text) {
    if (!window.speechSynthesis) return

    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 1.02

    window.speechSynthesis.speak(utter)
  }

  async function sendMessage(text) {
    if (!text.trim()) return

    const cleanMessage = text.trim()

    const contactEntry = {
      speaker: 'contact',
      text: cleanMessage,
      at: new Date().toISOString()
    }

    setTranscript(prev => [...prev, contactEntry])
    setThinking(true)

    try {
      const { reply } = await api.agentReply({
        contact,
        message: cleanMessage,
        history: transcript
      })

      const agentEntry = {
        speaker: 'agent',
        text: reply,
        at: new Date().toISOString()
      }

      setTranscript(prev => [...prev, agentEntry])

      speak(reply)
    } catch (err) {
      showToast(err.message || 'Could not reach Ollama')
    } finally {
      setThinking(false)
    }
  }

  function toggleListening() {
   
    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition

   
    if (!SpeechRecognitionImpl) {
      showToast(
        'Voice input is not supported in this browser. Please use Safari on iPhone or Chrome on Android, or type your message.'
      )

      manualInputRef.current?.focus()
      return
    }

    
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        
      }

      setListening(false)
      return
    }

    
    const recognition = new SpeechRecognitionImpl()

    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    
    recognition.onstart = () => {
      console.log('🎤 Speech recognition started')
      setListening(true)
    }

    
    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0]
      const text = result?.transcript?.trim()

      console.log('🎤 Speech result:', text)

      if (text) {
        sendMessage(text)
      }
    }

    
    recognition.onend = () => {
      console.log('🎤 Speech recognition ended')

      setListening(false)
      recognitionRef.current = null
    }

    // Recognition error.
    recognition.onerror = (event) => {
      console.error('🎤 Speech recognition error:', event.error)

      setListening(false)
      recognitionRef.current = null

      if (event.error === 'not-allowed') {
        showToast(
          'Microphone permission was denied. Allow microphone access for this website in your browser settings.'
        )
      } else if (event.error === 'service-not-allowed') {
        showToast(
          'Speech recognition is not allowed by this browser. Try Safari on iPhone or Chrome on Android.'
        )
      } else if (event.error === 'no-speech') {
        showToast(
          'I did not hear anything. Tap the microphone and try again.'
        )
      } else if (event.error === 'audio-capture') {
        showToast(
          'No microphone was detected. Check your microphone permissions.'
        )
      } else if (event.error !== 'aborted') {
        showToast(
          `Voice input failed: ${event.error}. You can type your message instead.`
        )
      }

      manualInputRef.current?.focus()
    }

    recognitionRef.current = recognition

    
    try {
      recognition.start()
    } catch (error) {
      console.error('🎤 Could not start recognition:', error)

      recognitionRef.current = null
      setListening(false)

      showToast(
        'Could not start the microphone. Check browser microphone permissions and try again.'
      )

      manualInputRef.current?.focus()
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()

    sendMessage(manualInput)

    setManualInput('')
  }

  async function endCall() {
    try {
      recognitionRef.current?.stop()
    } catch {
      
    }

    window.speechSynthesis?.cancel()

    const endedAt = new Date()

    const durationSeconds = Math.max(
      1,
      Math.round((endedAt - startedAt) / 1000)
    )

    try {
      await api.createCall({
        contact,
        status: transcript.length ? 'completed' : 'missed',
        durationSeconds,
        transcript,
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

  return (
    <div
      className="call-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.7)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        className="card call-modal"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <input
            value={contact}
            onChange={e => setContact(e.target.value)}
            className="input-field"
            style={{
              fontWeight: 600,
              fontSize: 15,
              border: 'none',
              background: 'transparent',
              padding: '4px 0'
            }}
          />

          <span
            style={{
              color: '#34d399',
              fontSize: 11,
              fontWeight: 700
            }}
          >
            ● LIVE
          </span>
        </div>

        <div
          className="call-transcript"
          style={{
            background: '#09090b',
            border: '1px solid #27272a',
            borderRadius: 18,
            padding: 16,
            height: 280,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          {transcript.length === 0 && (
            <div
              style={{
                color: '#71717a',
                fontSize: 13,
                textAlign: 'center',
                marginTop: 100
              }}
            >
              Press the mic and say something to start talking.
            </div>
          )}

          {transcript.map((entry, i) => (
            <div
              key={i}
              style={{
                alignSelf:
                  entry.speaker === 'agent'
                    ? 'flex-start'
                    : 'flex-end',
                maxWidth: '85%'
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: '#71717a',
                  textAlign:
                    entry.speaker === 'agent'
                      ? 'left'
                      : 'right'
                }}
              >
                {entry.speaker === 'agent' ? 'Agent' : contact}
              </div>

              <div
                style={{
                  color:
                    entry.speaker === 'agent'
                      ? '#fff'
                      : '#fde68a',
                  fontSize: 13,
                  textAlign:
                    entry.speaker === 'agent'
                      ? 'left'
                      : 'right'
                }}
              >
                {entry.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div
              style={{
                color: '#67e8f9',
                fontSize: 12
              }}
            >
              Agent is thinking…
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4
          }}
        >
          {listening &&
            [0, 1, 2].map(i => (
              <div
                key={i}
                className="wave"
                style={{
                  width: 5,
                  height: 20,
                  background: '#22d3ee',
                  borderRadius: 4,
                  animationDelay: `${i * 150}ms`
                }}
              />
            ))}
        </div>

        <button
          onClick={toggleListening}
          className="btn-outline"
          style={{
            height: 52,
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
            borderColor: listening
              ? '#22d3ee'
              : '#3f3f46',
            color: listening
              ? '#22d3ee'
              : '#e4e4e7'
          }}
        >
          {listening
            ? '🎙️ Listening… tap to stop'
            : '🎙️ Tap to speak'}
        </button>

        <form
          onSubmit={handleManualSubmit}
          className="manual-message-form"
          style={{
            display: 'flex',
            gap: 8
          }}
        >
          <input
            ref={manualInputRef}
            className="input-field"
            placeholder="…or type instead of speaking"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
          />

          <button
            className="btn-outline"
            style={{
              padding: '0 18px'
            }}
          >
            Send
          </button>
        </form>

        <button
          onClick={endCall}
          style={{
            height: 48,
            borderRadius: 999,
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            fontWeight: 600
          }}
        >
          📞 End call & save
        </button>
      </div>
    </div>
  )
}