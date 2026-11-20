import { useMemo, useState, useEffect, type RefObject } from 'react'

/** Lightweight windowed list for large catalogues (no extra dependency). */
export function useVirtualGrid<T>(
  items: T[],
  opts: {
    containerRef: RefObject<HTMLElement | null>
    rowHeight: number
    columns: number
    overscan?: number
  },
) {
  const { containerRef, rowHeight, columns, overscan = 2 } = opts
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    const ro = new ResizeObserver(() => setHeight(el.clientHeight || 480))
    ro.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    setHeight(el.clientHeight || 480)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [containerRef])

  const col = Math.max(1, columns)
  const rowCount = Math.ceil(items.length / col)
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleRows = Math.ceil(height / rowHeight) + overscan * 2
  const endRow = Math.min(rowCount, startRow + visibleRows)
  const startIndex = startRow * col
  const endIndex = Math.min(items.length, endRow * col)

  return useMemo(
    () => ({
      totalHeight: rowCount * rowHeight,
      offsetY: startRow * rowHeight,
      visible: items.slice(startIndex, endIndex),
      startIndex,
    }),
    [items, rowCount, rowHeight, startRow, startIndex, endIndex],
  )
}
