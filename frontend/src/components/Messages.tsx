import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { Conversation } from '../data/messages'
import { fetchConversations } from '../api/messages'
import ConversationThread from './messages/ConversationThread'
import { formatChatCountdown, formatRelativeTime } from '../utils/chatTime'

const LIST_POLL_MS = 10000

/**
 * The /messages section: temporary renter↔owner chats. The list on the left
 * and the open thread on the right both poll while this section is on screen.
 */
export default function Messages() {
  const location = useLocation()
  const isActive = location.pathname === '/messages'

  const initialId = (location.state as { conversationId?: number } | null)?.conversationId ?? null
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(initialId)

  const load = useCallback(() => {
    fetchConversations()
      .then((data) => {
        setConversations(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load messages'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isActive) return
    load()
    const timer = setInterval(load, LIST_POLL_MS)
    return () => clearInterval(timer)
  }, [isActive, load])

  // Derive the open chat so an expired one falls back to the next in line.
  const selected = conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null

  function handleExpired(id: number) {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
  }

  function handleActivity(updated: Conversation) {
    setConversations((prev) =>
      prev
        .map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        .sort((a, b) => (b.lastMessageAtMs ?? 0) - (a.lastMessageAtMs ?? 0))
    )
  }

  return (
    <div className="grid h-[75vh] w-full max-w-6xl grid-cols-3 gap-4">
      <div className="col-span-1 overflow-y-auto rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur dark:border dark:border-slate-800 dark:bg-slate-900/95">
        <h3 className="mb-3 text-lg font-bold text-slate-800 dark:text-slate-100">Messages</h3>
        <p className="mb-3 text-[11px] text-slate-400 dark:text-slate-500">
          Chats are temporary — they disappear 24 hours after the last message.
        </p>

        {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading messages…</p>}
        {error && <p className="text-sm text-red-500 dark:text-red-400">Couldn't load messages: {error}</p>}
        {!loading && !error && conversations.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            No messages yet. Open a listing and use “Message on Makatipid” to reach its owner.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full overflow-hidden rounded-xl px-3 py-2 text-left transition-colors ${
                selected?.id === c.id
                  ? 'bg-blue-100 border-2 border-blue-400 dark:bg-blue-500/15 dark:border-blue-400'
                  : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                  {c.counterpartName ?? 'User'}
                </p>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {c.lotName ?? 'Listing removed'}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                {c.lastMessageBody ?? 'No messages yet'}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {c.lastMessageAtMs ? formatRelativeTime(c.lastMessageAtMs) : 'New chat'}
                </span>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  ⏱ {formatChatCountdown(c.expiresInSeconds)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-2 overflow-hidden rounded-2xl bg-white/95 shadow-xl backdrop-blur dark:border dark:border-slate-800 dark:bg-slate-900/95">
        {selected ? (
          <ConversationThread
            key={selected.id}
            conversationId={selected.id}
            onExpired={handleExpired}
            onActivity={handleActivity}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Select a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}
