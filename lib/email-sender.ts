// Outreach email transport — delegates to Gmail API (lib/gmail.ts) so sent
// mail lives in arpit@aeredium.io's real Sent folder and replies thread
// naturally, which is what makes automatic reply detection possible.

import { sendEmail as gmailSend, isGmailConfigured } from './gmail'

export interface EmailResult {
  id?: string
  threadId?: string
  messageIdHeader?: string
  error?: string
}

export function isEmailConfigured(): boolean {
  return isGmailConfigured()
}

export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  replyTo?: string
  threadId?: string
  inReplyToMessageId?: string
  references?: string
}): Promise<EmailResult> {
  return gmailSend(opts)
}
