/** A single chat bubble. */
export interface Message {
  id: number
  conversationId: number
  senderId: number
  /** True when the signed-in user is the sender (from the server). */
  mine: boolean
  body: string
  /** Epoch milliseconds, timezone-proof (computed server-side). */
  createdAtMs: number
}

export type ConversationRole = 'owner' | 'renter'

/** A temporary renter↔owner chat, scoped to one listing. */
export interface Conversation {
  id: number
  propertyId: number
  lotName: string | null
  address: string | null
  ownerId: number
  renterId: number
  /** Whether the signed-in user is the owner or the renter in this chat. */
  role: ConversationRole
  counterpartId: number
  counterpartName: string | null
  lastMessageBody: string | null
  lastMessageAtMs: number | null
  unreadCount: number
  /** Seconds until the chat (and all its messages) is deleted. */
  expiresInSeconds: number
}

export interface ConversationThreadData {
  conversation: Conversation
  messages: Message[]
}

/** Chats last this long; a new message restarts the clock. Mirrors the server. */
export const CHAT_WINDOW_HOURS = 24
