import { api } from '@/lib/api'
import {
  getBranchSelectValue,
  ORG_BRANCH_ID,
  setActiveBranchId,
} from '@/lib/branch'

type BranchRow = {
  id: string
  isMain: boolean
}

/**
 * After business login/refresh: remap localStorage off any foreign branch id
 * left over from a previous shop/demo so early API calls stay in-tenant.
 */
export async function bootstrapActiveBranch(): Promise<void> {
  const data = await api<{
    branches: BranchRow[]
    activeBranchId: string | null
    membershipBranchId: string | null
  }>('/branches')

  const stored = getBranchSelectValue()
  // Keep a known in-tenant branch. Remap foreign ids and lone-branch ORG leftovers.
  if (
    stored &&
    stored !== ORG_BRANCH_ID &&
    data.branches.some((b) => b.id === stored)
  ) {
    return
  }
  if (stored === ORG_BRANCH_ID && data.branches.length > 1) {
    return
  }

  const next =
    data.activeBranchId ||
    data.membershipBranchId ||
    data.branches.find((b) => b.isMain)?.id ||
    data.branches[0]?.id ||
    ORG_BRANCH_ID

  setActiveBranchId(next)
}
