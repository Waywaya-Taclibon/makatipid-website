import { apiFetch } from './http'
import type { Conversation, ConversationThreadData, Message } from '../data/messages'

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return body && typeof body.message === 'string' ? body.message : fallback
}

/** Every live chat the user is part of (as owner or renter), newest first. */
export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiFetch('/messages/conversations')
  if (res.status === 401) throw new Error('Your session has expired. Please log in again.')
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to load messages (${res.status})`))
  return res.json()
}

/** Finds or creates the chat for a listing. Safe to call twice. */
export async function startConversation(propertyId: number): Promise<Conversation> {
  const res = await apiFetch('/messages/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId }),
  })
  if (res.status === 401) throw new Error('Your session has expired. Please log in again.')
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not open the conversation'))
  return res.json()
}

/**
 * Loads a thread. Pass `after` (the newest message id you already have) while
 * polling so only new messages come back.
 */
export async function fetchConversation(id: number, after?: number): Promise<ConversationThreadData> {
  const query = after && after > 0 ? `?after=${after}` : ''
  const res = await apiFetch(`/messages/conversations/${id}${query}`)
  if (res.status === 401) throw new Error('Your session has expired. Please log in again.')
  if (res.status === 404) throw new Error('This chat has expired.')
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to load the conversation (${res.status})`))
  return res.json()
}

export async function sendMessage(
  id: number,
  body: string,
): Promise<{ message: Message; expiresInSeconds: number }> {
  const res = await apiFetch(`/messages/conversations/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  if (res.status === 401) throw new Error('Your session has expired. Please log in again.')
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not send the message'))
  return res.json()
}

/** Unread total for the dashboard badge. Never throws — a badge is not critical. */
export async function fetchUnreadMessageCount(): Promise<number> {
  try {
    const res = await apiFetch('/messages/unread-count')
    if (!res.ok) return 0
    const data = await res.json()
    return Number.isFinite(Number(data?.count)) ? Number(data.count) : 0
  } catch {
    return 0
  }
}

export type { Conversation, Message }
