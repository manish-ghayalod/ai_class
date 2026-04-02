import { useState, useEffect } from 'react'
import EmailPanel from './components/EmailPanel'
import EmailDetail from './components/EmailDetail'
import AiPanel from './components/AiPanel'
import { API_BASE } from './api'

export default function App() {
  const [emails, setEmails] = useState([])
  const [filteredEmails, setFilteredEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activePanel, setActivePanel] = useState('emails')

  useEffect(() => {
    fetch(`${API_BASE}/api/emails`)
      .then(r => r.json())
      .then(data => {
        setEmails(data.emails)
        setFilteredEmails(data.emails)
      })
      .catch(err => console.error('Failed to load emails:', err))
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmails(emails)
    } else {
      const q = searchQuery.toLowerCase()
      setFilteredEmails(emails.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        e.date.includes(q)
      ))
    }
  }, [searchQuery, emails])

  function handleSelect(id) {
    setSelectedEmail(emails.find(e => e.id === id) ?? null)
    setActivePanel('detail')  // auto-navigate to detail on mobile when an email is selected
  }

  return (
    <div className="layout">
      <EmailPanel
        emails={filteredEmails}
        selectedEmailId={selectedEmail?.id ?? null}
        onSelect={handleSelect}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        isMobileActive={activePanel === 'emails'}
      />
      <EmailDetail
        email={selectedEmail}
        isMobileActive={activePanel === 'detail'}
      />
      <AiPanel isMobileActive={activePanel === 'ask'} />
      <MobileNav active={activePanel} onSwitch={setActivePanel} />
    </div>
  )
}

function MobileNav({ active, onSwitch }) {
  return (
    <nav className="mobile-nav">
      <button
        className={`mobile-nav__btn${active === 'emails' ? ' mobile-nav__btn--active' : ''}`}
        onClick={() => onSwitch('emails')}
      >
        <span className="mobile-nav__icon">✉</span>
        <span className="mobile-nav__label">Emails</span>
      </button>
      <button
        className={`mobile-nav__btn${active === 'detail' ? ' mobile-nav__btn--active' : ''}`}
        onClick={() => onSwitch('detail')}
      >
        <span className="mobile-nav__icon">📄</span>
        <span className="mobile-nav__label">Read</span>
      </button>
      <button
        className={`mobile-nav__btn${active === 'ask' ? ' mobile-nav__btn--active' : ''}`}
        onClick={() => onSwitch('ask')}
      >
        <span className="mobile-nav__icon">💬</span>
        <span className="mobile-nav__label">Ask Wile</span>
      </button>
    </nav>
  )
}
