// ─── State ───────────────────────────────────────────────────────────────────

let emails = [];
let filteredEmails = [];
let selectedEmailId = null;
let apiKey = '';
let chatHistory = [];
let isLoading = false;

// ─── DOM References ───────────────────────────────────────────────────────────

const emailList    = document.getElementById('emailList');
const emailDetail  = document.getElementById('emailDetail');
const emailSearch  = document.getElementById('emailSearch');
const chatWindow   = document.getElementById('chatWindow');
const chatInput    = document.getElementById('chatInput');
const sendBtn      = document.getElementById('sendBtn');
const clearChat    = document.getElementById('clearChat');
const apiKeyInput  = document.getElementById('apiKeyInput');
const apiKeySave   = document.getElementById('apiKeySave');

// ─── Load Emails ─────────────────────────────────────────────────────────────

async function loadEmails() {
  try {
    const res = await fetch('./data/wile_emails.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    emails = data.emails;
    filteredEmails = [...emails];
    renderEmailList();
  } catch (err) {
    emailList.innerHTML = `<div style="padding:16px;color:#fca5a5;font-size:12px;">
      Could not load emails.<br/>Make sure wile_emails.json is in the data/ folder.
    </div>`;
    console.error('Failed to load emails:', err);
  }
}

// ─── Render Email List ───────────────────────────────────────────────────────

function renderEmailList() {
  if (filteredEmails.length === 0) {
    emailList.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:12px;">No emails match your search.</div>`;
    return;
  }

  emailList.innerHTML = filteredEmails.map(email => `
    <div class="email-item ${email.id === selectedEmailId ? 'active' : ''}"
         data-id="${email.id}"
         onclick="selectEmail('${email.id}')">
      <div class="email-item__date">${formatDate(email.date)}</div>
      <div class="email-item__subject">${escapeHtml(email.subject)}</div>
      <div class="email-item__preview">${escapeHtml(getPreview(email.body))}</div>
    </div>
  `).join('');
}

// ─── Select & Display Email ──────────────────────────────────────────────────

function selectEmail(id) {
  selectedEmailId = id;
  const email = emails.find(e => e.id === id);
  if (!email) return;

  renderEmailList();

  const toList = Array.isArray(email.to) ? email.to.join(', ') : email.to;
  const ccList = email.cc && email.cc.length > 0 ? email.cc.join(', ') : null;

  emailDetail.innerHTML = `
    <div class="email-detail__meta">
      <div class="email-detail__subject">${escapeHtml(email.subject)}</div>
      <div class="email-meta-row">
        <span class="label">FROM</span>
        <span class="value">${escapeHtml(email.from)}</span>
      </div>
      <div class="email-meta-row">
        <span class="label">TO</span>
        <span class="value">${escapeHtml(toList)}</span>
      </div>
      ${ccList ? `<div class="email-meta-row">
        <span class="label">CC</span>
        <span class="value">${escapeHtml(ccList)}</span>
      </div>` : ''}
      <div class="email-meta-row">
        <span class="label">DATE</span>
        <span class="value">${formatDateLong(email.date)}</span>
      </div>
    </div>
    <div class="email-detail__body">${escapeHtml(email.body)}</div>
  `;
}

// ─── Search ──────────────────────────────────────────────────────────────────

emailSearch.addEventListener('input', () => {
  const query = emailSearch.value.toLowerCase().trim();
  if (!query) {
    filteredEmails = [...emails];
  } else {
    filteredEmails = emails.filter(e =>
      e.subject.toLowerCase().includes(query) ||
      e.body.toLowerCase().includes(query) ||
      e.from.toLowerCase().includes(query) ||
      e.date.includes(query)
    );
  }
  renderEmailList();
});

// ─── API Key ──────────────────────────────────────────────────────────────────

apiKeySave.addEventListener('click', () => {
  const val = apiKeyInput.value.trim();
  if (!val.startsWith('sk-ant-')) {
    alert('That does not look like a valid Anthropic API key. It should start with sk-ant-');
    return;
  }
  apiKey = val;
  apiKeyInput.value = '••••••••••••••••••••';

  const hint = document.querySelector('.field-hint');
  hint.innerHTML = '<span class="key-saved">✓ Key saved — ready to ask questions</span>';
});

// ─── Chat ─────────────────────────────────────────────────────────────────────

sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

clearChat.addEventListener('click', () => {
  chatHistory = [];
  chatWindow.innerHTML = `
    <div class="chat-message chat-message--system">
      <div class="chat-message__bubble">
        This is Wile Coyote's AI persona. Ask about past decisions, deal assumptions, or analytical framework. Answers are grounded in his email history.
      </div>
    </div>`;
});

async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question || isLoading) return;

  if (!apiKey) {
    appendMessage('error', null, 'Please enter and save your Anthropic API key first.');
    return;
  }

  chatInput.value = '';
  appendMessage('user', 'You', question);

  const loadingId = appendLoadingIndicator();
  isLoading = true;
  sendBtn.disabled = true;

  // Build the system prompt with all emails as context
  const emailContext = emails.map(e =>
    `--- EMAIL ID: ${e.id} | DATE: ${e.date} | FROM: ${e.from} | TO: ${Array.isArray(e.to) ? e.to.join(', ') : e.to} | SUBJECT: ${e.subject} ---\n${e.body}`
  ).join('\n\n');

  const systemPrompt = `You are an AI persona representing Wile Coyote, a retired Senior Portfolio Manager at Acme Asset Management who spent 18+ years structuring Collateralized Loan Obligations (CLOs). You have been given access to Wile's complete email archive.

Your role is to answer questions by reasoning over his emails and reconstructing his thinking. When answering:
- Ground every claim in specific emails, referencing dates and subjects where relevant
- Speak in the third person about Wile (e.g. "Wile's reasoning was..." or "Based on his December 2020 email to T. Roadrunner...")
- Be precise about numbers and methodology — this is a financial context
- If multiple emails together explain the answer, synthesize them
- If the emails do not contain enough information to answer confidently, say so clearly
- Do not invent information that is not supported by the emails

Here is Wile Coyote's complete email archive:

${emailContext}`;

  // Add to history and call API
  chatHistory.push({ role: 'user', content: question });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: chatHistory
      })
    });

    removeLoadingIndicator(loadingId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const reply = data.content.map(b => b.text || '').join('');
    chatHistory.push({ role: 'assistant', content: reply });
    appendMessage('assistant', 'Wile (AI Persona)', reply);

  } catch (err) {
    removeLoadingIndicator(loadingId);
    appendMessage('error', null, `Error: ${err.message}`);
    chatHistory.pop(); // remove the failed user message from history
    console.error(err);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// ─── Chat Helpers ─────────────────────────────────────────────────────────────

function appendMessage(type, role, text) {
  const div = document.createElement('div');
  div.className = `chat-message chat-message--${type}`;
  div.innerHTML = `
    ${role ? `<div class="chat-message__role">${escapeHtml(role)}</div>` : ''}
    <div class="chat-message__bubble">${escapeHtml(text)}</div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function appendLoadingIndicator() {
  const id = 'loading-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-message chat-message--loading';
  div.id = id;
  div.innerHTML = `
    <div class="chat-message__role" style="color:var(--teal)">WILE (AI PERSONA)</div>
    <div class="chat-message__bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return id;
}

function removeLoadingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPreview(body) {
  return body.replace(/\n/g, ' ').slice(0, 80).trim() + '…';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadEmails();
