import { useEffect, useState } from 'react'
import { runScanSelfTest } from '@/lib/scanSelfTest'

/** Dev / CI: prove synthetic barcode decode is under 1s in this browser. */
export function ScanBenchPage() {
  const [line, setLine] = useState('running…')

  useEffect(() => {
    void runScanSelfTest()
      .then((r) => {
        const next = `${r.ok ? 'PASS' : 'FAIL'} ${r.engine} warm=${r.ms.toFixed(1)}ms cold=${r.coldMs.toFixed(1)}ms code=${r.code}`
        setLine(next)
        document.title = next
      })
      .catch((err) => {
        const next = `FAIL ${err instanceof Error ? err.message : 'error'}`
        setLine(next)
        document.title = next
      })
  }, [])

  return (
    <pre
      id="scan-bench-result"
      style={{
        fontFamily: 'ui-monospace, monospace',
        padding: 24,
        fontSize: 16,
      }}
    >
      {line}
    </pre>
  )
}
