export type AppRole = 'owner' | 'staff'

const ROLE_KEY = 'nexora-role'

export function getRole(): AppRole {
  const value = localStorage.getItem(ROLE_KEY)
  return value === 'staff' ? 'staff' : 'owner'
}

export function setRole(role: AppRole) {
  localStorage.setItem(ROLE_KEY, role)
}

export function canSeeCost(role: AppRole) {
  return role === 'owner'
}

export function canSeeReports(role: AppRole) {
  return role === 'owner'
}
