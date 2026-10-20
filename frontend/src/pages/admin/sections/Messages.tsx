import { useEffect, useState } from 'react'
import {
  fetchAdminConversation,
  fetchAdminConversations,
  type AdminConversation,
  type AdminMessage,
  type Paged,
} from '../../../api/admin'
import {
  ActionButton,
  Badge,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
} from '../ui'
import { formatDateTime, useDebounced } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function Messages() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminConversation> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<AdminConversation | null>(null)
  const [thread, setThread] = useState<AdminMessage[] | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminConversations({ q: debouncedQ, page })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, page])

  function closeThread() {
    setSelected(null)
    setThread(null)
    setThreadError(null)
  }

  async function openThread(conversation: AdminConversation) {
    setSelected(conversation)
    setThread(null)
    setThreadError(null)
    setThreadLoading(true)
    try {
      const result = await fetchAdminConversation(conversation.id)
      setThread(result.messages)
      setSelected(result.conversation)
    } catch (err) {
      setThreadError(errText(err))
    } finally {
      setThreadLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Read-only oversight of temporary chats. Threads self-destruct 24 hours after the last message."
      />

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
            placeholder="Search by listing, owner or renter…"
          />
          {loading && <span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>}
        </div>

        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty>No active conversations.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">Listing</th>
                    <th className="pb-2 pr-3 font-semibold">Participants</th>
                    <th className="pb-2 pr-3 font-semibold">Messages</th>
                    <th className="pb-2 pr-3 font-semibold">Last message</th>
                    <th className="pb-2 pr-3 font-semibold">Expires</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((conversation) => (
                    <tr key={conversation.id} className="align-top">
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">#{conversation.id}</td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {conversation.lotName || `Property #${conversation.propertyId}`}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600 dark:text-slate-300">
                        <p>Owner: {conversation.ownerName || '—'}</p>
                        <p>Renter: {conversation.renterName || '—'}</p>
                      </td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{conversation.messageCount}</td>
                      <td className="max-w-[260px] py-3 pr-3">
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                          {conversation.lastMessage || '—'}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {formatDateTime(conversation.lastMessageAt)}
                        </p>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-xs">
                        {conversation.expired ? (
                          <Badge tone="red">Expired</Badge>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            {formatDateTime(conversation.expiresAt)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <ActionButton variant="subtle" onClick={() => void openThread(conversation)}>
                          View
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              onPage={(next) => {
                setLoading(true)
                setPage(next)
              }}
            />
          </>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close conversation"
            className="absolute inset-0 cursor-default bg-black/40"
            onClick={closeThread}
          />
          <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Conversation #{selected.id}
                </p>
                <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                  {selected.lotName || `Property #${selected.propertyId}`}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selected.ownerName || 'Owner'} ↔ {selected.renterName || 'Renter'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.expired && <Badge tone="red">Expired</Badge>}
                <button
                  type="button"
                  onClick={closeThread}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {threadLoading ? (
                <Loading label="Loading messages…" />
              ) : threadError ? (
                <ErrorNote>{threadError}</ErrorNote>
              ) : !thread || thread.length === 0 ? (
                <Empty>No messages in this conversation.</Empty>
              ) : (
                <ul className="space-y-3">
                  {thread.map((message) => (
                    <li key={message.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {message.senderName}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{message.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-slate-200 p-3 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Read-only oversight. Messages cannot be edited or deleted from this console.
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}
