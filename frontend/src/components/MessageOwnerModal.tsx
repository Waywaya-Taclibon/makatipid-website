import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Property } from '../data/properties'
import { startConversation } from '../api/messages'
import ConversationThread from './messages/ConversationThread'
import Spinner from './Spinner'

interface MessageOwnerModalProps {
  property: Property
  onClose: () => void
}

/**
 * Opens the temporary chat with a listing's owner without leaving the page.
 * Creating the thread is idempotent, so a double-click can't make two chats.
 */
export default function MessageOwnerModal({ property, onClose }: MessageOwnerModalProps) {
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    startConversation(property.id)
      .then((conversation) => {
        if (!cancelled) setConversationId(conversation.id)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open the conversation')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [property.id, attempt])

  function retry() {
    setError(null)
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-owner-title"
        className="flex h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:border dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h3 id="message-owner-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Message Owner
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {property.lotName} · {property.address}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-1 text-xl leading-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close message window"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500">
              <Spinner className="h-4 w-4" />
              Opening chat…
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              <button
                onClick={retry}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Try again
              </button>
            </div>
          ) : conversationId != null ? (
            <ConversationThread
              key={conversationId}
              conversationId={conversationId}
              onExpired={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
