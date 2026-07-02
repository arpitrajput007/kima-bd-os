// Thin Resend wrapper — no SDK dependency, plain fetch.
// Requires: RESEND_API_KEY + RESEND_FROM_EMAIL in .env.local

export interface EmailResult {
  id?: string
  error?: string
}

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  replyTo?: string
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    return { error: 'Email not configured (RESEND_API_KEY / RESEND_FROM_EMAIL missing)' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        reply_to: opts.replyTo,
      }),
    })

    const data = await res.json().catch(() => ({})) as { id?: string; message?: string }
    if (!res.ok) {
      return { error: data.message || `Resend HTTP ${res.status}` }
    }
    return { id: data.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Send failed' }
  }
}
