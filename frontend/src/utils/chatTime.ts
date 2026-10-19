/**
 * Formats the remaining lifetime of a temporary chat.
 * e.g. 24h → "23h 59m", 58m → "58m 12s", 9s → "9s".
 */
export function formatChatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  if (total >= 3600) {
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  if (total >= 60) {
    const minutes = Math.floor(total / 60)
    const secs = total % 60
    return `${minutes}m ${secs}s`
  }
  return `${total}s`
}

/** Wall-clock time of a message, in the viewer's local timezone. */
export function formatMessageTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

/** "just now", "5m ago", "3h ago" — relative to the local clock. */
export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
