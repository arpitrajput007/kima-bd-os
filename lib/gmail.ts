// Thin Gmail API wrapper — plain fetch, no googleapis dependency.
// Sends outreach as arpit@aeredium.io and lets us detect replies by polling
// the same thread, since Gmail groups messages by thread + In-Reply-To.
//
// Requires (.env.local):
//   GMAIL_CLIENT_ID
//   GMAIL_CLIENT_SECRET
//   GMAIL_REFRESH_TOKEN   (obtained once via OAuth consent, scopes: gmail.send + gmail.readonly)
//   GMAIL_SENDER_EMAIL    (arpit@aeredium.io)

export interface GmailSendResult {
  id?: string
  threadId?: string
  messageIdHeader?: string
  error?: string
}

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_SENDER_EMAIL
  )
}

// Cached for the lifetime of this serverless invocation.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || `Gmail token refresh failed (HTTP ${res.status})`)
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedToken.value
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeHeader(text: string): string {
  // RFC 2047 encoded-word for non-ASCII subjects; plain ASCII passes through untouched.
  if (/^[\x00-\x7F]*$/.test(text)) return text
  return `=?UTF-8?B?${Buffer.from(text, 'utf-8').toString('base64')}?=`
}

export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  replyTo?: string
  threadId?: string
  inReplyToMessageId?: string
  references?: string
}): Promise<GmailSendResult> {
  if (!isGmailConfigured()) {
    return { error: 'Gmail not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN / GMAIL_SENDER_EMAIL missing)' }
  }

  const from = process.env.GMAIL_SENDER_EMAIL!
  const messageId = `<${crypto.randomUUID()}@aeredium.io>`

  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ]
  if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`)
  if (opts.inReplyToMessageId) headers.push(`In-Reply-To: ${opts.inReplyToMessageId}`)
  if (opts.references) headers.push(`References: ${opts.references}`)

  const raw = base64url(`${headers.join('\r\n')}\r\n\r\n${opts.text}`)

  try {
    const token = await getAccessToken()
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw, threadId: opts.threadId }),
    })
    const data = await res.json().catch(() => ({})) as { id?: string; threadId?: string; error?: { message?: string } }
    if (!res.ok) {
      return { error: data.error?.message || `Gmail HTTP ${res.status}` }
    }
    return { id: data.id, threadId: data.threadId, messageIdHeader: messageId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gmail send failed' }
  }
}

interface GmailThreadMessage {
  id: string
  internalDate?: string
  payload?: { headers?: { name: string; value: string }[] }
}

function headerValue(msg: GmailThreadMessage, name: string): string | undefined {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value
}

// Returns the most recent message in the thread if it did NOT come from us —
// i.e. a reply worth surfacing. Null if no reply yet (or thread not found).
export async function checkThreadForReply(
  threadId: string,
): Promise<{ from: string; snippet: string; date: string } | null> {
  if (!isGmailConfigured()) return null
  const senderEmail = process.env.GMAIL_SENDER_EMAIL!.toLowerCase()

  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return null
    const data = await res.json() as { messages?: GmailThreadMessage[]; snippet?: string }
    const messages = data.messages ?? []
    if (messages.length < 2) return null // only our own sent message(s) so far

    const last = messages[messages.length - 1]
    const from = headerValue(last, 'From') ?? ''
    if (from.toLowerCase().includes(senderEmail)) return null // last message is still ours

    return {
      from,
      snippet: data.snippet || '',
      date: headerValue(last, 'Date') ?? new Date(Number(last.internalDate ?? 0)).toISOString(),
    }
  } catch {
    return null
  }
}
