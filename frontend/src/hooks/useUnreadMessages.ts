import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchUnreadMessageCount } from '../api/messages'

const POLL_MS = 30000

/**
 * Total unread messages for the dashboard badge. Polls only while signed in
 * and the tab is visible. Not critical, so failures resolve to 0.
 */
export function useUnreadMessages(): number {
  const { token } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetchUnreadMessageCount().then((next) => {
        if (!cancelled) setCount(next)
      })
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [token])

  return token ? count : 0
}
