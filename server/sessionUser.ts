import type { Business, Membership, User } from '@prisma/client'
import { effectivePermissions } from './permissions.js'
import { parseModulesJson } from './industries.js'

export function businessSessionUser(
  user: Pick<User, 'id' | 'email' | 'fullName'>,
  membership: Pick<Membership, 'role' | 'permissions' | 'businessId'>,
  business: Pick<Business, 'name' | 'industry' | 'modulesJson' | 'settingsJson'>,
) {
  const modules = parseModulesJson(business.modulesJson, business.industry)
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    kind: 'business' as const,
    role: membership.role,
    businessId: membership.businessId,
    businessName: business.name,
    industry: business.industry || 'retail',
    modules,
    permissions: effectivePermissions(
      membership.role,
      membership.permissions,
    ),
  }
}
