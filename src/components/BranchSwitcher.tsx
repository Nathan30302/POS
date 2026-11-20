import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { getActiveBranchId, setActiveBranchId } from '@/lib/branch'

type Branch = {
  id: string
  name: string
  code?: string | null
  isMain: boolean
}

export function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeId, setActiveId] = useState<string>(getActiveBranchId() || '')
  const [error, setError] = useState('')

  useEffect(() => {
    void api<{
      branches: Branch[]
      activeBranchId: string | null
    }>('/branches')
      .then((data) => {
        setBranches(data.branches)
        const next =
          getActiveBranchId() ||
          data.activeBranchId ||
          data.branches.find((b) => b.isMain)?.id ||
          data.branches[0]?.id ||
          ''
        if (next && next !== getActiveBranchId()) {
          setActiveBranchId(next)
        }
        setActiveId(next)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load branches'),
      )
  }, [])

  async function onChange(id: string) {
    setActiveId(id)
    setActiveBranchId(id || null)
    try {
      await api('/branches/active', {
        method: 'POST',
        body: JSON.stringify({ branchId: id || null }),
      })
    } catch {
      /* local header still applies */
    }
  }

  if (error) {
    return compact ? null : (
      <p className="text-xs text-danger">{error}</p>
    )
  }

  if (branches.length <= 1) {
    if (compact) return null
    return (
      <p className="text-sm text-ink-soft">
        One branch (main). Add more from Team when you expand locations.
      </p>
    )
  }

  return (
    <label className={compact ? 'block min-w-0' : 'block space-y-1.5'}>
      {!compact ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
          <MapPin className="h-3.5 w-3.5" />
          Active branch
        </span>
      ) : null}
      <select
        value={activeId}
        onChange={(e) => void onChange(e.target.value)}
        className={
          compact
            ? 'max-w-[9.5rem] truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink outline-none focus:border-royal'
            : 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal'
        }
        aria-label="Active branch"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.isMain ? ' · main' : ''}
            {b.code ? ` (${b.code})` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
