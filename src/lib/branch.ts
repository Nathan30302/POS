const BRANCH_KEY = 'nexora-branch-id'

export function getActiveBranchId(): string | null {
  return localStorage.getItem(BRANCH_KEY)
}

export function setActiveBranchId(id: string | null) {
  if (id) localStorage.setItem(BRANCH_KEY, id)
  else localStorage.removeItem(BRANCH_KEY)
  window.dispatchEvent(new Event('nexora-branch'))
}
