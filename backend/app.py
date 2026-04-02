import json
import os
import re

import anthropic
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins='*')

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'wile_emails.json')


def load_emails():
    with open(DATA_PATH, encoding='utf-8') as f:
        return json.load(f)['emails']


def build_email_context():
    emails = load_emails()
    return '\n\n'.join(
        f"--- EMAIL ID: {e['id']} | DATE: {e['date']} | FROM: {e['from']} | "
        f"TO: {', '.join(e['to']) if isinstance(e['to'], list) else e['to']} | "
        f"SUBJECT: {e['subject']} ---\n{e['body']}"
        for e in emails
    )


def historical_system_prompt():
    return f"""You are an AI persona representing Wile Coyote, a retired Senior Portfolio Manager at Acme Asset Management who spent 18+ years structuring Collateralized Loan Obligations (CLOs). You have been given access to Wile's complete email archive.

Your role is to answer questions by reasoning over his emails and reconstructing his thinking. When answering:
- Ground every claim in specific emails, referencing dates and subjects where relevant
- Speak in the third person about Wile (e.g. "Wile's reasoning was..." or "Based on his December 2020 email to T. Roadrunner...")
- Be precise about numbers and methodology — this is a financial context
- If multiple emails together explain the answer, synthesize them
- If the emails do not contain enough information to answer confidently, say so clearly
- Do not invent information that is not supported by the emails

Here is Wile Coyote's complete email archive:

{build_email_context()}"""


def pool_system_prompt():
    return f"""You are an AI persona representing Wile Coyote, a retired Senior Portfolio Manager at Acme Asset Management who spent 18+ years structuring CLOs and mortgage-backed securities.

You are being asked to apply Wile's analytical framework to a NEW mortgage pool. Your job is to reason as Wile would have — using his documented CDR calibration methodology, geographic concentration overlays, seasoning adjustments, and state-specific penalties — and provide a CDR recommendation for the new pool.

When answering:
- Walk through Wile's framework step by step: base CDR from the LTV/FICO grid, then each adjustment overlay with its rationale
- Reference how Wile handled similar characteristics in past deals, drawing on his email archive
- Be specific about basis point adjustments and their rationale
- Conclude with a recommended base CDR and brief stress case comment
- Speak in the third person: "Based on Wile's framework..." or "Wile would have applied..."

Here is Wile Coyote's complete email archive for reference:

{build_email_context()}"""


@app.route('/api/emails')
def get_emails():
    return jsonify({'emails': load_emails()})


@app.route('/api/chat/historical', methods=['POST'])
def chat_historical():
    body = request.json
    api_key = body.get('apiKey')
    messages = body.get('messages', [])
    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=1024,
            system=historical_system_prompt(),
            messages=messages,
        )
        return jsonify({'reply': response.content[0].text})
    except anthropic.APIStatusError as e:
        return jsonify({'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/chat/pool', methods=['POST'])
def chat_pool():
    body = request.json
    api_key = body.get('apiKey')
    messages = body.get('messages', [])
    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=1024,
            system=pool_system_prompt(),
            messages=messages,
        )
        return jsonify({'reply': response.content[0].text})
    except anthropic.APIStatusError as e:
        return jsonify({'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/extract-pdf', methods=['POST'])
def extract_pdf():
    body = request.json
    api_key = body.get('apiKey')
    pdf_base64 = body.get('pdfBase64')

    extract_prompt = """You are a structured finance analyst. Extract the key mortgage pool characteristics from this offering memorandum and return them as a JSON object only — no markdown, no explanation, just the raw JSON.

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
}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=1024,
            messages=[{
                'role': 'user',
                'content': [
                    {
                        'type': 'document',
                        'source': {
                            'type': 'base64',
                            'media_type': 'application/pdf',
                            'data': pdf_base64,
                        },
                    },
                    {'type': 'text', 'text': extract_prompt},
                ],
            }],
        )
        raw = response.content[0].text.strip()
        clean = re.sub(r'```json\n?', '', raw)
        clean = re.sub(r'```\n?', '', clean).strip()
        return jsonify(json.loads(clean))
    except anthropic.APIStatusError as e:
        return jsonify({'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
