import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import {
  getBranchSelectValue,
  ORG_BRANCH_ID,
  setActiveBranchId,
} from '@/lib/branch'
import { useAuth } from '@/context/AuthContext'

type Branch = {
  id: string
  name: string
  code?: string | null
  isMain: boolean
}

export function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeId, setActiveId] = useState<string>(getBranchSelectValue())
  const [error, setError] = useState('')

  const canUseOrgView =
    user?.role === 'OWNER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'BRANCH_MANAGER' ||
    user?.role === 'ACCOUNTANT'

  useEffect(() => {
    void api<{
      branches: Branch[]
      activeBranchId: string | null
    }>('/branches')
      .then((data) => {
        setBranches(data.branches)
        const stored = getBranchSelectValue()
        if (stored === ORG_BRANCH_ID && canUseOrgView) {
          setActiveId(ORG_BRANCH_ID)
          return
        }
        if (stored && stored !== ORG_BRANCH_ID) {
          const known = data.branches.some((b) => b.id === stored)
          if (known) {
            setActiveId(stored)
            return
          }
        }
        const next =
          data.activeBranchId ||
          data.branches.find((b) => b.isMain)?.id ||
          data.branches[0]?.id ||
          (canUseOrgView ? ORG_BRANCH_ID : '')
        if (next) {
          setActiveBranchId(next)
          setActiveId(next)
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load branches'),
      )
  }, [canUseOrgView])

  async function onChange(id: string) {
    setActiveId(id)
    setActiveBranchId(id)
    try {
      await api('/branches/active', {
        method: 'POST',
        body: JSON.stringify({
          branchId: id === ORG_BRANCH_ID ? null : id,
        }),
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

  if (branches.length <= 1 && !canUseOrgView) {
    if (compact) return null
    return (
      <p className="text-sm text-ink-soft">
        One branch (main). Add or rename locations in Settings → Branches.
      </p>
    )
  }

  if (branches.length === 0) {
    return compact ? null : (
      <p className="text-sm text-ink-soft">No branches yet.</p>
    )
  }

  const showOrg = canUseOrgView && branches.length > 1

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
            ? 'max-w-[7.5rem] truncate rounded-lg border border-line bg-surface px-1.5 py-1 text-[10px] font-semibold text-ink outline-none focus:border-royal sm:max-w-[9.5rem] sm:px-2 sm:py-1.5 sm:text-[11px]'
            : 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal'
        }
        aria-label="Active branch"
      >
        {showOrg ? (
          <option value={ORG_BRANCH_ID}>All branches · HO</option>
        ) : null}
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
