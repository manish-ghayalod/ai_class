function formatDateLong(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function EmailDetail({ email, isMobileActive }) {
  return (
    <main className={`panel panel--center${isMobileActive ? ' panel--mobile-active' : ''}`}>
      <div className="email-detail">
        {!email ? (
          <div className="email-detail__empty">
            <div className="empty-icon">✉</div>
            <p>Select an email to read</p>
          </div>
        ) : (
          <>
            <div className="email-detail__meta">
              <div className="email-detail__subject">{email.subject}</div>
              <div className="email-meta-row">
                <span className="label">FROM</span>
                <span className="value">{email.from}</span>
              </div>
              <div className="email-meta-row">
                <span className="label">TO</span>
                <span className="value">
                  {Array.isArray(email.to) ? email.to.join(', ') : email.to}
                </span>
              </div>
              {email.cc && email.cc.length > 0 && (
                <div className="email-meta-row">
                  <span className="label">CC</span>
                  <span className="value">{email.cc.join(', ')}</span>
                </div>
              )}
              <div className="email-meta-row">
                <span className="label">DATE</span>
                <span className="value">{formatDateLong(email.date)}</span>
              </div>
            </div>
            <div className="email-detail__body">{email.body}</div>
          </>
        )}
      </div>
    </main>
  )
}
