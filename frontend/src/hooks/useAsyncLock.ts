import { useCallback, useRef, useState } from 'react'

/**
 * Synchronous in-flight guard for async UI actions.
 *
 * React state is not a mutex: a second click can fire before the disabled
 * attribute is committed. `run` checks a ref before doing anything, refuses
 * overlapping calls, and always releases the lock in `finally`.
 */
export function useAsyncLock() {
  const lockedRef = useRef(false)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (task: () => Promise<void>): Promise<boolean> => {
    if (lockedRef.current) return false
    lockedRef.current = true
    setBusy(true)
    try {
      await task()
      return true
    } finally {
      lockedRef.current = false
      setBusy(false)
    }
  }, [])

  return { busy, run }
}
