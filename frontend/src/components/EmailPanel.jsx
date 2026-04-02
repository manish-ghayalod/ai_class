function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function getPreview(body) {
  return body.replace(/\n/g, ' ').slice(0, 80).trim() + '…'
}

export default function EmailPanel({ emails, selectedEmailId, onSelect, searchQuery, onSearch, isMobileActive }) {
  return (
    <aside className={`panel panel--left${isMobileActive ? ' panel--mobile-active' : ''}`}>
      <div className="panel__header">
        <span className="panel__label">DIGITAL FOOTPRINT</span>
        <h2 className="panel__title">Wile Coyote</h2>
        <p className="panel__subtitle">Sr. Portfolio Manager, Structured Products<br />2006 – 2024</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search emails…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="email-list">
        {emails.length === 0 ? (
          <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No emails match your search.
          </div>
        ) : (
          emails.map(email => (
            <div
              key={email.id}
              className={`email-item${email.id === selectedEmailId ? ' active' : ''}`}
              onClick={() => onSelect(email.id)}
            >
              <div className="email-item__date">{formatDate(email.date)}</div>
              <div className="email-item__subject">{email.subject}</div>
              <div className="email-item__preview">{getPreview(email.body)}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
