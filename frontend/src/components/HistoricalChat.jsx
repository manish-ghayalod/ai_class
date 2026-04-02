import { useState, useRef, useEffect } from 'react'
import { API_BASE } from '../api'

const INITIAL_MESSAGE = {
  id: 'init',
  type: 'system',
  role: null,
  text: "Ask Wile about past decisions, deal assumptions, or his analytical framework. Answers are grounded in his email archive.",
}

export default function HistoricalChat({ apiKey }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState([])
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || isLoading) return
    if (!apiKey) {
      setMessages(m => [...m, { id: Date.now(), type: 'error', role: null, text: 'Please enter and save your Anthropic API key first.' }])
      return
    }

    const question = input.trim()
    setInput('')
    const newHistory = [...history, { role: 'user', content: question }]
    setHistory(newHistory)
    setMessages(m => [...m, { id: Date.now(), type: 'user', role: 'You', text: question }])

    const loadingId = Date.now() + 1
    setMessages(m => [...m, { id: loadingId, type: 'loading', role: null, text: '' }])
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat/historical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, messages: newHistory }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `API error ${res.status}`)
      }
      const data = await res.json()
      setHistory(h => [...h, { role: 'assistant', content: data.reply }])
      setMessages(m => m.map(msg =>
        msg.id === loadingId
          ? { id: loadingId, type: 'assistant', role: 'Wile (AI Persona)', text: data.reply }
          : msg
      ))
    } catch (err) {
      setHistory(h => h.slice(0, -1))
      setMessages(m => m.map(msg =>
        msg.id === loadingId
          ? { id: loadingId, type: 'error', role: null, text: `Error: ${err.message}` }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  function clearChat() {
    setMessages([INITIAL_MESSAGE])
    setHistory([])
  }

  return (
    <div className="tab-content">
      <div className="chat-window" ref={chatRef}>
        {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
      </div>
      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="e.g. Why did Wile set the CDR at 3.2% for Sunrise Mortgage Trust 2021-3?"
          rows={3}
        />
        <div className="chat-actions">
          <button className="btn btn--ghost btn--small" onClick={clearChat}>Clear</button>
          <button className="btn btn--primary" onClick={sendMessage} disabled={isLoading}>Ask Wile →</button>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ msg }) {
  return (
    <div className={`chat-message chat-message--${msg.type}`}>
      {msg.type === 'loading' ? (
        <>
          <div className="chat-message__role" style={{ color: 'var(--mit-red)' }}>WILE (AI PERSONA)</div>
          <div className="chat-message__bubble">
            <div className="typing-dots"><span /><span /><span /></div>
          </div>
        </>
      ) : (
        <>
          {msg.role && <div className="chat-message__role">{msg.role}</div>}
          <div className="chat-message__bubble">{msg.text}</div>
        </>
      )}
    </div>
  )
}
