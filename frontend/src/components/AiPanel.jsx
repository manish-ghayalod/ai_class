import { useState } from 'react'
import HistoricalChat from './HistoricalChat'
import NewPoolAnalysis from './NewPoolAnalysis'

export default function AiPanel({ isMobileActive }) {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [currentTab, setCurrentTab] = useState('historical')

  function saveApiKey() {
    const val = apiKeyInput.trim()
    if (!val.startsWith('sk-ant-')) {
      alert('That does not look like a valid Anthropic API key. It should start with sk-ant-')
      return
    }
    setApiKey(val)
    setApiKeyInput('••••••••••••••••••••')
    setKeySaved(true)
  }

  return (
    <aside className={`panel panel--right${isMobileActive ? ' panel--mobile-active' : ''}`}>
      <div className="panel__header">
        <span className="panel__label">AI PERSONA</span>
        <h2 className="panel__title">Ask Wile</h2>
        <p className="panel__subtitle">Powered by institutional memory</p>
      </div>

      <div className="api-key-section">
        <label className="field-label">Anthropic API Key</label>
        <div className="api-key-row">
          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
          />
          <button className="btn btn--small" onClick={saveApiKey}>Save</button>
        </div>
        <p className="field-hint">
          {keySaved
            ? <span className="key-saved">✓ Key saved — ready to ask questions</span>
            : 'Key is stored in memory only and never sent anywhere except Anthropic.'
          }
        </p>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn${currentTab === 'historical' ? ' tab-btn--active' : ''}`}
          onClick={() => setCurrentTab('historical')}
        >
          Historical Lookup
        </button>
        <button
          className={`tab-btn${currentTab === 'newpool' ? ' tab-btn--active' : ''}`}
          onClick={() => setCurrentTab('newpool')}
        >
          New Pool Analysis
        </button>
      </div>

      {currentTab === 'historical'
        ? <HistoricalChat apiKey={apiKey} />
        : <NewPoolAnalysis apiKey={apiKey} />
      }
    </aside>
  )
}
