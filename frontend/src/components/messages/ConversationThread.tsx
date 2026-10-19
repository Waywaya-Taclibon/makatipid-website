import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Conversation, Message } from '../../data/messages'
import { fetchConversation, sendMessage } from '../../api/messages'
import { useAsyncLock } from '../../hooks/useAsyncLock'
import Spinner from '../Spinner'
import { formatChatCountdown, formatMessageTime } from '../../utils/chatTime'

interface ConversationThreadProps {
  conversationId: number
  /** Fired once when the chat dies (server 404 or the countdown reaching zero). */
  onExpired?: (conversationId: number) => void
  /** Fired when a message arrives, so the parent list can resync. */
  onActivity?: (conversation: Conversation) => void
}

const POLL_MS = 5000

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

/**
 * The chat itself, reused by the /messages page and the Contact Owner modal.
 * Every chat is temporary: the server returns how long it has left, and the
 * client just counts that down (and re-reads it on each poll so it can't drift).
 */
export default function ConversationThread({
  conversationId,
  onExpired,
  onActivity,
}: ConversationThreadProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serverExpired, setServerExpired] = useState(false)
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [draft, setDraft] = useState('')

  const { busy: sending, run: runSend } = useAsyncLock()
  const lastIdRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the latest callbacks without re-running the polling effect on every render.
  const onExpiredRef = useRef(onExpired)
  const onActivityRef = useRef(onActivity)
  useEffect(() => {
    onExpiredRef.current = onExpired
    onActivityRef.current = onActivity
  })

  useEffect(() => {
    let cancelled = false
    fetchConversation(conversationId)
      .then((data) => {
        if (cancelled) return
        setConversation(data.conversation)
        setMessages(data.messages)
        lastIdRef.current = data.messages.length > 0 ? data.messages[data.messages.length - 1].id : 0
        setExpiresAtMs(Date.now() + Math.max(0, data.conversation.expiresInSeconds) * 1000)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof Error && /expired/i.test(err.message)) setServerExpired(true)
        else setError(err instanceof Error ? err.message : 'Could not load the conversation')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  // Poll for new messages while the thread is alive.
  useEffect(() => {
    if (serverExpired) return
    const timer = setInterval(() => {
      fetchConversation(conversationId, lastIdRef.current)
        .then((data) => {
          if (data.messages.length > 0) {
            setMessages((prev) => [...prev, ...data.messages])
            lastIdRef.current = data.messages[data.messages.length - 1].id
            onActivityRef.current?.(data.conversation)
          }
          setConversation(data.conversation)
          setExpiresAtMs(Date.now() + Math.max(0, data.conversation.expiresInSeconds) * 1000)
        })
        .catch((err) => {
          if (err instanceof Error && /expired/i.test(err.message)) setServerExpired(true)
        })
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [conversationId, serverExpired])

  // Re-render once a second so the countdown ticks.
  useEffect(() => {
    if (expiresAtMs == null) return
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAtMs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const remaining = expiresAtMs != null ? Math.max(0, Math.ceil((expiresAtMs - nowTick) / 1000)) : null
  const expired = serverExpired || (remaining !== null && remaining <= 0)

  const notifiedExpiredRef = useRef(false)
  useEffect(() => {
    if (!expired || notifiedExpiredRef.current) return
    notifiedExpiredRef.current = true
    onExpiredRef.current?.(conversationId)
  }, [expired, conversationId])

  async function submitMessage() {
    const body = draft.trim()
    if (!body || expired || sending) return
    await runSend(async () => {
      try {
        const { message, expiresInSeconds } = await sendMessage(conversationId, body)
        setMessages((prev) => [...prev, message])
        lastIdRef.current = message.id
        setDraft('')
        setError(null)
        setExpiresAtMs(Date.now() + Math.max(0, expiresInSeconds) * 1000)
        if (conversation) {
          onActivityRef.current?.({
            ...conversation,
            lastMessageBody: body,
            lastMessageAtMs: message.createdAtMs,
            expiresInSeconds,
            unreadCount: 0,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send the message')
      }
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void submitMessage()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
              {conversation?.counterpartName ?? (conversation?.role === 'owner' ? 'Renter' : 'Property owner')}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {conversation?.lotName
                ? `${conversation.lotName}${conversation.address ? ` · ${conversation.address}` : ''}`
                : 'Temporary chat'}
            </p>
          </div>
          {remaining !== null && !expired && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <ClockIcon className="h-3.5 w-3.5" />
              {formatChatCountdown(remaining)}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          Temporary chat — it disappears 24 hours after the last message.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500">
            <Spinner className="h-4 w-4" />
            Loading messages…
          </div>
        ) : expired ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">This chat has expired</p>
            <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
              Temporary chats (and every message in them) are deleted 24 hours after the last message.
            </p>
          </div>
        ) : (
          <>
            {error && <p className="mb-3 text-sm text-red-500 dark:text-red-400">{error}</p>}
            {messages.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No messages yet — say hello and introduce yourself.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.mine
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.mine ? 'text-blue-100/80' : 'text-slate-400 dark:text-slate-500'}`}>
                      {formatMessageTime(m.createdAtMs)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submitMessage()
              }
            }}
            disabled={expired || sending}
            rows={1}
            maxLength={2000}
            placeholder={expired ? 'This chat has expired' : 'Write a message…'}
            className="min-h-[42px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50"
          />
          <button
            type="submit"
            disabled={expired || sending || !draft.trim()}
            className="flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <Spinner className="h-4 w-4" /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
