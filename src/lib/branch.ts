/** Sentinel stored in localStorage for Head Office / all-branches view. */
export const ORG_BRANCH_ID = '__all__'

const BRANCH_KEY = 'nexora-branch-id'

/** Active single-branch id, or null when Head Office / unset. */
export function getActiveBranchId(): string | null {
  const v = localStorage.getItem(BRANCH_KEY)
  if (!v || v === ORG_BRANCH_ID) return null
  return v
}

/** True when owner selected consolidated Head Office view. */
export function isOrgView(): boolean {
  return localStorage.getItem(BRANCH_KEY) === ORG_BRANCH_ID
}

/**
 * Persist branch scope.
 * Pass ORG_BRANCH_ID (or empty) for Head Office; a real id for one branch.
 */
export function setActiveBranchId(id: string | null) {
  if (!id || id === ORG_BRANCH_ID) {
    localStorage.setItem(BRANCH_KEY, ORG_BRANCH_ID)
  } else {
    localStorage.setItem(BRANCH_KEY, id)
  }
  window.dispatchEvent(new Event('nexora-branch'))
}

/** Raw value for select controls (ORG_BRANCH_ID or branch cuid). */
export function getBranchSelectValue(): string {
  return localStorage.getItem(BRANCH_KEY) || ORG_BRANCH_ID
}

/** Drop stored branch (e.g. on logout) so the next shop does not inherit it. */
export function clearActiveBranchId() {
  localStorage.removeItem(BRANCH_KEY)
  window.dispatchEvent(new Event('nexora-branch'))
}
