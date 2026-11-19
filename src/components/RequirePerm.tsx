import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import {
  businessHomePath,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission,
} from '@/lib/permissions'

type Props = {
  permission: Permission | null
  children: ReactNode
}

/** Blocks deep-links to pages the signed-in staff role cannot use. */
export function RequirePerm({ permission, children }: Props) {
  const { user, can } = useAuth()
  if (permission && !can(permission)) {
    const home = businessHomePath(user?.permissions, user?.role)
    const label = PERMISSION_LABELS[permission]
    const roleLabel = ROLE_LABELS[user?.role || ''] || user?.role || 'Staff'
    return (
      <div className="mx-auto max-w-lg">
        <div className="nx-card flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-royal">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="font-display mt-4 text-xl font-bold text-ink">
            Not in your access
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            <strong className="text-ink">{label}</strong> isn’t enabled for your{' '}
            {roleLabel} login. Ask an owner if you need it.
          </p>
          <Link to={home} className="mt-6">
            <Button type="button">Go to your workspace</Button>
          </Link>
        </div>
      </div>
    )
  }
  return children
}
