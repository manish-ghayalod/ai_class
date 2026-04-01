// ─── State ───────────────────────────────────────────────────────────────────

let emails          = [];
let filteredEmails  = [];
let selectedEmailId = null;
let apiKey          = '';
let chatHistory     = [];
let poolChatHistory = [];
let isLoading       = false;
let extractedPoolData = null;
let currentTab      = 'historical';

// ─── DOM References ───────────────────────────────────────────────────────────

const emailList       = document.getElementById('emailList');
const emailDetail     = document.getElementById('emailDetail');
const emailSearch     = document.getElementById('emailSearch');
const chatWindow      = document.getElementById('chatWindow');
const chatInput       = document.getElementById('chatInput');
const sendBtn         = document.getElementById('sendBtn');
const clearChat       = document.getElementById('clearChat');
const apiKeyInput     = document.getElementById('apiKeyInput');
const apiKeySave      = document.getElementById('apiKeySave');

// New pool analysis
const pdfFileInput    = document.getElementById('pdfFileInput');
const uploadZone      = document.getElementById('uploadZone');
const uploadStatus    = document.getElementById('uploadStatus');
const uploadSection   = document.getElementById('uploadSection');
const analysisSection = document.getElementById('analysisSection');
const extractResult   = document.getElementById('extractResult');
const poolChatPrompt  = document.getElementById('poolChatPrompt');
const poolChatActive  = document.getElementById('poolChatActive');
const poolChatWindow  = document.getElementById('poolChatWindow');
const poolChatInput   = document.getElementById('poolChatInput');
const poolSendBtn     = document.getElementById('poolSendBtn');
const askWilePoolBtn  = document.getElementById('askWilePoolBtn');
const reuploadBtn     = document.getElementById('reuploadBtn');
const newAnalysisBtn  = document.getElementById('newAnalysisBtn');

// ─── Tab Switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabContentHistorical').classList.toggle('tab-content--hidden', tab !== 'historical');
  document.getElementById('tabContentNewPool').classList.toggle('tab-content--hidden', tab !== 'newpool');
  document.getElementById('tabHistorical').classList.toggle('tab-btn--active', tab === 'historical');
  document.getElementById('tabNewPool').classList.toggle('tab-btn--active', tab === 'newpool');
}

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
      Could not load emails.<br/>Make sure wile_emails.json is in the data/ folder.</div>`;
    console.error(err);
  }
}

// ─── Email List ───────────────────────────────────────────────────────────────

function renderEmailList() {
  if (filteredEmails.length === 0) {
    emailList.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:12px;">No emails match your search.</div>`;
    return;
  }
  emailList.innerHTML = filteredEmails.map(email => `
    <div class="email-item ${email.id === selectedEmailId ? 'active' : ''}"
         data-id="${email.id}" onclick="selectEmail('${email.id}')">
      <div class="email-item__date">${formatDate(email.date)}</div>
      <div class="email-item__subject">${escapeHtml(email.subject)}</div>
      <div class="email-item__preview">${escapeHtml(getPreview(email.body))}</div>
    </div>
  `).join('');
}

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
      <div class="email-meta-row"><span class="label">FROM</span><span class="value">${escapeHtml(email.from)}</span></div>
      <div class="email-meta-row"><span class="label">TO</span><span class="value">${escapeHtml(toList)}</span></div>
      ${ccList ? `<div class="email-meta-row"><span class="label">CC</span><span class="value">${escapeHtml(ccList)}</span></div>` : ''}
      <div class="email-meta-row"><span class="label">DATE</span><span class="value">${formatDateLong(email.date)}</span></div>
    </div>
    <div class="email-detail__body">${escapeHtml(email.body)}</div>`;
}

emailSearch.addEventListener('input', () => {
  const query = emailSearch.value.toLowerCase().trim();
  filteredEmails = !query ? [...emails] : emails.filter(e =>
    e.subject.toLowerCase().includes(query) ||
    e.body.toLowerCase().includes(query) ||
    e.from.toLowerCase().includes(query) ||
    e.date.includes(query)
  );
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
  document.querySelector('.field-hint').innerHTML =
    '<span class="key-saved">✓ Key saved — ready to ask questions</span>';
});

// ─── Historical Lookup Chat ───────────────────────────────────────────────────

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

clearChat.addEventListener('click', () => {
  chatHistory = [];
  chatWindow.innerHTML = `
    <div class="chat-message chat-message--system">
      <div class="chat-message__bubble">
        Ask Wile about past decisions, deal assumptions, or his analytical framework. Answers are grounded in his email archive.
      </div>
    </div>`;
});

async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question || isLoading) return;
  if (!apiKey) { appendMessage(chatWindow, 'error', null, 'Please enter and save your Anthropic API key first.'); return; }

  chatInput.value = '';
  appendMessage(chatWindow, 'user', 'You', question);
  const loadingId = appendLoadingIndicator(chatWindow);
  isLoading = true;
  sendBtn.disabled = true;

  const systemPrompt = `You are an AI persona representing Wile Coyote, a retired Senior Portfolio Manager at Acme Asset Management who spent 18+ years structuring Collateralized Loan Obligations (CLOs). You have been given access to Wile's complete email archive.

Your role is to answer questions by reasoning over his emails and reconstructing his thinking. When answering:
- Ground every claim in specific emails, referencing dates and subjects where relevant
- Speak in the third person about Wile (e.g. "Wile's reasoning was..." or "Based on his December 2020 email to T. Roadrunner...")
- Be precise about numbers and methodology — this is a financial context
- If multiple emails together explain the answer, synthesize them
- If the emails do not contain enough information to answer confidently, say so clearly
- Do not invent information that is not supported by the emails

Here is Wile Coyote's complete email archive:

${buildEmailContext()}`;

  chatHistory.push({ role: 'user', content: question });
  try {
    const reply = await callClaude(systemPrompt, chatHistory);
    removeLoadingIndicator(loadingId);
    chatHistory.push({ role: 'assistant', content: reply });
    appendMessage(chatWindow, 'assistant', 'Wile (AI Persona)', reply);
  } catch (err) {
    removeLoadingIndicator(loadingId);
    appendMessage(chatWindow, 'error', null, `Error: ${err.message}`);
    chatHistory.pop();
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// ─── PDF Upload ───────────────────────────────────────────────────────────────

uploadZone.addEventListener('click', () => pdfFileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('upload-zone--drag');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('upload-zone--drag'));

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('upload-zone--drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handlePdfUpload(file);
  else setUploadStatus('Please drop a PDF file.', 'error');
});

pdfFileInput.addEventListener('change', () => {
  if (pdfFileInput.files[0]) handlePdfUpload(pdfFileInput.files[0]);
});

reuploadBtn.addEventListener('click', resetToUpload);
newAnalysisBtn.addEventListener('click', resetAnalysis);

function resetToUpload() {
  extractedPoolData = null;
  poolChatHistory = [];
  poolChatWindow.innerHTML = '';
  pdfFileInput.value = '';
  setUploadStatus('', '');
  // Show upload section, hide analysis section
  uploadSection.classList.remove('pool-section--hidden');
  analysisSection.classList.add('pool-section--hidden');
}

function resetAnalysis() {
  // Keep the characteristics visible, just reset the chat
  poolChatHistory = [];
  poolChatWindow.innerHTML = '';
  poolChatActive.classList.add('pool-section--hidden');
  poolChatPrompt.classList.remove('pool-section--hidden');
}

async function handlePdfUpload(file) {
  if (!apiKey) {
    setUploadStatus('Please save your API key before uploading.', 'error');
    return;
  }
  setUploadStatus(`Reading ${file.name}…`, 'loading');
  try {
    const base64 = await fileToBase64(file);
    setUploadStatus('Extracting pool characteristics…', 'loading');
    const extracted = await extractPoolData(base64);
    extractedPoolData = extracted;
    renderExtractedData(extracted);
    // Show analysis section, hide upload section
    uploadSection.classList.add('pool-section--hidden');
    analysisSection.classList.remove('pool-section--hidden');
    setUploadStatus('', '');
  } catch (err) {
    setUploadStatus(`Error: ${err.message}`, 'error');
    console.error(err);
  }
}

async function extractPoolData(base64Pdf) {
  const extractPrompt = `You are a structured finance analyst. Extract the key mortgage pool characteristics from this offering memorandum and return them as a JSON object only — no markdown, no explanation, just the raw JSON.

Return this exact structure (use null for any field not found):
{
  "deal_name": "",
  "pool_balance": "",
  "num_loans": "",
  "avg_loan_balance": "",
  "wa_ltv": "",
  "wa_fico": "",
  "wa_dti": "",
  "wa_coupon": "",
  "wa_seasoning": "",
  "wa_remaining_term": "",
  "pct_fixed": "",
  "pct_owner_occ": "",
  "pct_judicial": "",
  "hhi": "",
  "largest_state": "",
  "largest_state_pct": "",
  "second_state": "",
  "second_state_pct": "",
  "third_state": "",
  "third_state_pct": "",
  "senior_ce": "",
  "pricing_date": "",
  "key_risks": ""
}`;

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
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
          { type: 'text', text: extractPrompt }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content.map(b => b.text || '').join('').trim();
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

function renderExtractedData(d) {
  const field = (label, value) => (value && value !== 'null' && value !== 'None') ? `
    <div class="extract-row">
      <span class="extract-label">${label}</span>
      <span class="extract-value">${escapeHtml(String(value))}</span>
    </div>` : '';

  extractResult.innerHTML = `
    <div class="extract-deal-name">${escapeHtml(d.deal_name || 'Unnamed Deal')}</div>
    <div class="extract-grid">
      ${field('Pool Balance', d.pool_balance)}
      ${field('No. of Loans', d.num_loans)}
      ${field('Avg Loan Balance', d.avg_loan_balance)}
      ${field('WA LTV', d.wa_ltv)}
      ${field('WA FICO', d.wa_fico)}
      ${field('WA DTI', d.wa_dti)}
      ${field('WA Coupon', d.wa_coupon)}
      ${field('WA Seasoning', d.wa_seasoning)}
      ${field('WA Rem. Term', d.wa_remaining_term)}
      ${field('% Fixed Rate', d.pct_fixed)}
      ${field('% Owner Occ.', d.pct_owner_occ)}
      ${field('% Judicial', d.pct_judicial)}
      ${field('HHI', d.hhi)}
      ${field('Senior CE', d.senior_ce)}
      ${field('Largest State', d.largest_state ? `${d.largest_state} (${d.largest_state_pct})` : null)}
      ${field('2nd State', d.second_state ? `${d.second_state} (${d.second_state_pct})` : null)}
      ${field('3rd State', d.third_state ? `${d.third_state} (${d.third_state_pct})` : null)}
      ${field('Pricing Date', d.pricing_date)}
    </div>
    ${d.key_risks ? `<div class="extract-risks"><span class="extract-label">Key Risks</span><p>${escapeHtml(d.key_risks)}</p></div>` : ''}
  `;
}

// ─── New Pool Analysis Chat ───────────────────────────────────────────────────

askWilePoolBtn.addEventListener('click', () => {
  if (!extractedPoolData) return;
  poolChatPrompt.classList.add('pool-section--hidden');
  poolChatActive.classList.remove('pool-section--hidden');
  startPoolAnalysis();
});

poolSendBtn.addEventListener('click', sendPoolMessage);
poolChatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPoolMessage(); }
});

async function startPoolAnalysis() {
  const poolSummary = buildPoolSummary(extractedPoolData);
  const question = `Given the following mortgage pool characteristics from ${extractedPoolData.deal_name || 'this new deal'}, what CDR would Wile Coyote have set as the base case assumption, and why?\n\n${poolSummary}`;

  appendMessage(poolChatWindow, 'user', 'You', `Analyzing ${extractedPoolData.deal_name || 'new pool'}…`);
  const loadingId = appendLoadingIndicator(poolChatWindow);
  isLoading = true;
  poolSendBtn.disabled = true;

  poolChatHistory = [{ role: 'user', content: question }];
  try {
    const reply = await callClaude(buildPoolSystemPrompt(), poolChatHistory);
    removeLoadingIndicator(loadingId);
    poolChatHistory.push({ role: 'assistant', content: reply });
    appendMessage(poolChatWindow, 'assistant', 'Wile (AI Persona)', reply);
  } catch (err) {
    removeLoadingIndicator(loadingId);
    appendMessage(poolChatWindow, 'error', null, `Error: ${err.message}`);
    poolChatHistory = [];
  } finally {
    isLoading = false;
    poolSendBtn.disabled = false;
  }
}

async function sendPoolMessage() {
  const question = poolChatInput.value.trim();
  if (!question || isLoading) return;
  if (!apiKey) { appendMessage(poolChatWindow, 'error', null, 'Please save your API key first.'); return; }

  poolChatInput.value = '';
  appendMessage(poolChatWindow, 'user', 'You', question);
  const loadingId = appendLoadingIndicator(poolChatWindow);
  isLoading = true;
  poolSendBtn.disabled = true;

  poolChatHistory.push({ role: 'user', content: question });
  try {
    const reply = await callClaude(buildPoolSystemPrompt(), poolChatHistory);
    removeLoadingIndicator(loadingId);
    poolChatHistory.push({ role: 'assistant', content: reply });
    appendMessage(poolChatWindow, 'assistant', 'Wile (AI Persona)', reply);
  } catch (err) {
    removeLoadingIndicator(loadingId);
    appendMessage(poolChatWindow, 'error', null, `Error: ${err.message}`);
    poolChatHistory.pop();
  } finally {
    isLoading = false;
    poolSendBtn.disabled = false;
    poolChatInput.focus();
  }
}

function buildPoolSystemPrompt() {
  return `You are an AI persona representing Wile Coyote, a retired Senior Portfolio Manager at Acme Asset Management who spent 18+ years structuring CLOs and mortgage-backed securities.

You are being asked to apply Wile's analytical framework to a NEW mortgage pool. Your job is to reason as Wile would have — using his documented CDR calibration methodology, geographic concentration overlays, seasoning adjustments, and state-specific penalties — and provide a CDR recommendation for the new pool.

When answering:
- Walk through Wile's framework step by step: base CDR from the LTV/FICO grid, then each adjustment overlay with its rationale
- Reference how Wile handled similar characteristics in past deals, drawing on his email archive
- Be specific about basis point adjustments and their rationale
- Conclude with a recommended base CDR and brief stress case comment
- Speak in the third person: "Based on Wile's framework..." or "Wile would have applied..."

Here is Wile Coyote's complete email archive for reference:

${buildEmailContext()}`;
}

function buildPoolSummary(d) {
  const lines = [];
  if (d.pool_balance)     lines.push(`Pool Balance: ${d.pool_balance}`);
  if (d.num_loans)        lines.push(`Number of Loans: ${d.num_loans}`);
  if (d.wa_ltv)           lines.push(`WA LTV: ${d.wa_ltv}`);
  if (d.wa_fico)          lines.push(`WA FICO: ${d.wa_fico}`);
  if (d.wa_dti)           lines.push(`WA DTI: ${d.wa_dti}`);
  if (d.wa_seasoning)     lines.push(`WA Seasoning: ${d.wa_seasoning}`);
  if (d.hhi)              lines.push(`Geographic HHI: ${d.hhi}`);
  if (d.pct_judicial)     lines.push(`% Judicial State Exposure: ${d.pct_judicial}`);
  if (d.largest_state)    lines.push(`Largest State: ${d.largest_state} (${d.largest_state_pct})`);
  if (d.second_state)     lines.push(`2nd State: ${d.second_state} (${d.second_state_pct})`);
  if (d.third_state)      lines.push(`3rd State: ${d.third_state} (${d.third_state_pct})`);
  if (d.pct_fixed)        lines.push(`% Fixed Rate: ${d.pct_fixed}`);
  if (d.pct_owner_occ)    lines.push(`% Owner Occupied: ${d.pct_owner_occ}`);
  if (d.senior_ce)        lines.push(`Senior CE: ${d.senior_ce}`);
  return lines.join('\n');
}

// ─── Shared API Call ──────────────────────────────────────────────────────────

async function callClaude(systemPrompt, messages) {
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
      messages
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content.map(b => b.text || '').join('');
}

// ─── Chat Helpers ─────────────────────────────────────────────────────────────

function appendMessage(container, type, role, text) {
  const div = document.createElement('div');
  div.className = `chat-message chat-message--${type}`;
  div.innerHTML = `
    ${role ? `<div class="chat-message__role">${escapeHtml(role)}</div>` : ''}
    <div class="chat-message__bubble">${escapeHtml(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendLoadingIndicator(container) {
  const id = 'loading-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-message chat-message--loading';
  div.id = id;
  div.innerHTML = `
    <div class="chat-message__role" style="color:var(--mit-red)">WILE (AI PERSONA)</div>
    <div class="chat-message__bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeLoadingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function buildEmailContext() {
  return emails.map(e =>
    `--- EMAIL ID: ${e.id} | DATE: ${e.date} | FROM: ${e.from} | TO: ${Array.isArray(e.to) ? e.to.join(', ') : e.to} | SUBJECT: ${e.subject} ---\n${e.body}`
  ).join('\n\n');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPreview(body) {
  return body.replace(/\n/g, ' ').slice(0, 80).trim() + '…';
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US',
    { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadEmails();
