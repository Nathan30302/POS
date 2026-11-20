import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

/** Hold to repeat an action (cart +/-). First fire immediate, then after delay. */
export function usePressRepeat(
  action: () => void,
  opts?: { delayMs?: number; intervalMs?: number },
) {
  const delayMs = opts?.delayMs ?? 380
  const intervalMs = opts?.intervalMs ?? 70
  const delayRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const actionRef = useRef(action)
  actionRef.current = action

  function clear() {
    if (delayRef.current != null) window.clearTimeout(delayRef.current)
    if (intervalRef.current != null) window.clearInterval(intervalRef.current)
    delayRef.current = null
    intervalRef.current = null
  }

  function start(e: ReactPointerEvent) {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    actionRef.current()
    clear()
    delayRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => actionRef.current(), intervalMs)
    }, delayMs)
  }

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  }
}
