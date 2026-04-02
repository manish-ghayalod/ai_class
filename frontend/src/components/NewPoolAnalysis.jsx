import { useState, useRef, useEffect } from 'react'
import { API_BASE } from '../api'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function buildPoolSummary(d) {
  const lines = []
  if (d.pool_balance)   lines.push(`Pool Balance: ${d.pool_balance}`)
  if (d.num_loans)      lines.push(`Number of Loans: ${d.num_loans}`)
  if (d.wa_ltv)         lines.push(`WA LTV: ${d.wa_ltv}`)
  if (d.wa_fico)        lines.push(`WA FICO: ${d.wa_fico}`)
  if (d.wa_dti)         lines.push(`WA DTI: ${d.wa_dti}`)
  if (d.wa_seasoning)   lines.push(`WA Seasoning: ${d.wa_seasoning}`)
  if (d.hhi)            lines.push(`Geographic HHI: ${d.hhi}`)
  if (d.pct_judicial)   lines.push(`% Judicial State Exposure: ${d.pct_judicial}`)
  if (d.largest_state)  lines.push(`Largest State: ${d.largest_state} (${d.largest_state_pct})`)
  if (d.second_state)   lines.push(`2nd State: ${d.second_state} (${d.second_state_pct})`)
  if (d.third_state)    lines.push(`3rd State: ${d.third_state} (${d.third_state_pct})`)
  if (d.pct_fixed)      lines.push(`% Fixed Rate: ${d.pct_fixed}`)
  if (d.pct_owner_occ)  lines.push(`% Owner Occupied: ${d.pct_owner_occ}`)
  if (d.senior_ce)      lines.push(`Senior CE: ${d.senior_ce}`)
  return lines.join('\n')
}

export default function NewPoolAnalysis({ apiKey }) {
  const [phase, setPhase] = useState('upload')       // 'upload' | 'analysis'
  const [chatPhase, setChatPhase] = useState('prompt') // 'prompt' | 'active'
  const [extractedData, setExtractedData] = useState(null)
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState({ text: '', type: '' })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function handleFile(file) {
    if (!apiKey) {
      setUploadStatus({ text: 'Please save your API key before uploading.', type: 'error' })
      return
    }
    setUploadStatus({ text: `Reading ${file.name}…`, type: 'loading' })
    try {
      const base64 = await fileToBase64(file)
      setUploadStatus({ text: 'Extracting pool characteristics…', type: 'loading' })
      const res = await fetch(`${API_BASE}/api/extract-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, pdfBase64: base64 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `API error ${res.status}`)
      }
      const data = await res.json()
      setExtractedData(data)
      setPhase('analysis')
      setUploadStatus({ text: '', type: '' })
    } catch (err) {
      setUploadStatus({ text: `Error: ${err.message}`, type: 'error' })
    }
  }

  function resetToUpload() {
    setExtractedData(null)
    setHistory([])
    setMessages([])
    setChatPhase('prompt')
    setPhase('upload')
    setUploadStatus({ text: '', type: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetAnalysis() {
    setHistory([])
    setMessages([])
    setChatPhase('prompt')
  }

  async function startPoolAnalysis() {
    setChatPhase('active')
    const poolSummary = buildPoolSummary(extractedData)
    const question = `Given the following mortgage pool characteristics from ${extractedData.deal_name || 'this new deal'}, what CDR would Wile Coyote have set as the base case assumption, and why?\n\n${poolSummary}`
    const newHistory = [{ role: 'user', content: question }]
    setHistory(newHistory)
    setMessages([{ id: Date.now(), type: 'user', role: 'You', text: `Analyzing ${extractedData.deal_name || 'new pool'}…` }])

    const loadingId = Date.now() + 1
    setMessages(m => [...m, { id: loadingId, type: 'loading', role: null, text: '' }])
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat/pool`, {
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
      setHistory([])
      setMessages(m => m.map(msg =>
        msg.id === loadingId
          ? { id: loadingId, type: 'error', role: null, text: `Error: ${err.message}` }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function sendPoolMessage() {
    if (!input.trim() || isLoading) return
    if (!apiKey) {
      setMessages(m => [...m, { id: Date.now(), type: 'error', role: null, text: 'Please save your API key first.' }])
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
      const res = await fetch(`${API_BASE}/api/chat/pool`, {
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

  return (
    <div className="tab-content" id="tabContentNewPool">
      {phase === 'upload' && (
        <div className="pool-section">
          <p className="pool-section__label">STEP 1 — UPLOAD OFFERING MEMORANDUM</p>
          <div
            className={`upload-zone${isDragging ? ' upload-zone--drag' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files[0]
              if (file && file.type === 'application/pdf') handleFile(file)
              else setUploadStatus({ text: 'Please drop a PDF file.', type: 'error' })
            }}
          >
            <div className="upload-zone__icon">📄</div>
            <p className="upload-zone__text">Drop a PDF here or click to browse</p>
            <p className="upload-zone__hint">Supports any RMBS offering memorandum</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]) }}
            />
          </div>
          {uploadStatus.text && (
            <div className={`upload-status${uploadStatus.type ? ` upload-status--${uploadStatus.type}` : ''}`}>
              {uploadStatus.text}
            </div>
          )}
        </div>
      )}

      {phase === 'analysis' && (
        <div className="pool-section pool-section--analysis">
          <div className="pool-characteristics">
            <div className="pool-characteristics__header">
              <span className="pool-section__label">POOL CHARACTERISTICS</span>
              <button className="btn btn--ghost btn--small" onClick={resetToUpload}>Upload New PDF</button>
            </div>
            <div className="extract-result">
              <ExtractedData data={extractedData} />
            </div>
          </div>

          <div className="analysis-divider" />

          <div className="pool-chat-area">
            {chatPhase === 'prompt' && (
              <div className="pool-chat-prompt">
                <button className="btn btn--primary btn--full" onClick={startPoolAnalysis}>
                  Ask Wile About This Pool →
                </button>
              </div>
            )}

            {chatPhase === 'active' && (
              <div className="pool-chat-active">
                <p className="pool-section__label">WILE'S ANALYSIS</p>
                <div className="chat-window chat-window--pool" ref={chatRef}>
                  {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
                </div>
                <div className="chat-input-area" style={{ padding: 0, borderTop: 'none' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPoolMessage() } }}
                    placeholder="Ask a follow-up question about this pool…"
                    rows={2}
                  />
                  <div className="chat-actions">
                    <button className="btn btn--ghost btn--small" onClick={resetAnalysis}>New Analysis</button>
                    <button className="btn btn--primary" onClick={sendPoolMessage} disabled={isLoading}>Send →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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

function ExtractedData({ data: d }) {
  function field(label, value) {
    if (!value || value === 'null' || value === 'None') return null
    return (
      <div className="extract-row" key={label}>
        <span className="extract-label">{label}</span>
        <span className="extract-value">{String(value)}</span>
      </div>
    )
  }

  return (
    <>
      <div className="extract-deal-name">{d.deal_name || 'Unnamed Deal'}</div>
      <div className="extract-grid">
        {field('Pool Balance', d.pool_balance)}
        {field('No. of Loans', d.num_loans)}
        {field('Avg Loan Balance', d.avg_loan_balance)}
        {field('WA LTV', d.wa_ltv)}
        {field('WA FICO', d.wa_fico)}
        {field('WA DTI', d.wa_dti)}
        {field('WA Coupon', d.wa_coupon)}
        {field('WA Seasoning', d.wa_seasoning)}
        {field('WA Rem. Term', d.wa_remaining_term)}
        {field('% Fixed Rate', d.pct_fixed)}
        {field('% Owner Occ.', d.pct_owner_occ)}
        {field('% Judicial', d.pct_judicial)}
        {field('HHI', d.hhi)}
        {field('Senior CE', d.senior_ce)}
        {field('Largest State', d.largest_state ? `${d.largest_state} (${d.largest_state_pct})` : null)}
        {field('2nd State', d.second_state ? `${d.second_state} (${d.second_state_pct})` : null)}
        {field('3rd State', d.third_state ? `${d.third_state} (${d.third_state_pct})` : null)}
        {field('Pricing Date', d.pricing_date)}
      </div>
      {d.key_risks && (
        <div className="extract-risks">
          <span className="extract-label">Key Risks</span>
          <p>{d.key_risks}</p>
        </div>
      )}
    </>
  )
}
