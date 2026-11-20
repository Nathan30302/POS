import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { NexoraShell } from '@/components/layout/NexoraShell'
import { RequirePerm } from '@/components/RequirePerm'
import { useAuth } from '@/context/AuthContext'
import { businessHomePath, canSeeCommand } from '@/lib/permissions'
import { BarcodesPage } from '@/pages/BarcodesPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { PhoneScannerPage } from '@/pages/PhoneScannerPage'
import { PlatformHomePage } from '@/pages/platform/PlatformHomePage'
import { CheckoutPage } from '@/pages/checkout/CheckoutPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { OwnerDashboardPage } from '@/pages/OwnerDashboardPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { TeamPage } from '@/pages/TeamPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { StockConflictsPage } from '@/pages/StockConflictsPage'
import { ScanBenchPage } from '@/pages/ScanBenchPage'

function Guard({
  children,
  kind,
}: {
  children: ReactNode
  kind?: 'platform' | 'business'
}) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-teal text-sm font-bold text-white shadow-lg shadow-royal/30">
          NX
        </div>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-royal/25 border-t-royal" />
        <p className="text-sm text-ink-soft">Opening your shop OS…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (kind && user.kind !== kind) {
    return (
      <Navigate
        to={
          user.kind === 'platform'
            ? '/platform'
            : businessHomePath(user.permissions, user.role)
        }
        replace
      />
    )
  }
  return children
}

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.kind === 'platform') return <Navigate to="/platform" replace />
  return (
    <Navigate to={businessHomePath(user.permissions, user.role)} replace />
  )
}

function CommandRoute() {
  const { user } = useAuth()
  if (!canSeeCommand(user?.role)) {
    return (
      <Navigate
        to={businessHomePath(user?.permissions, user?.role)}
        replace
      />
    )
  }
  return <OwnerDashboardPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/scan-bench" element={<ScanBenchPage />} />
      <Route path="/phone-scan/:roomId" element={<PhoneScannerPage />} />

      <Route
        path="/platform"
        element={
          <Guard kind="platform">
            <PlatformHomePage />
          </Guard>
        }
      />

      <Route
        path="/app"
        element={
          <Guard kind="business">
            <NexoraShell />
          </Guard>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<CommandRoute />} />
        <Route
          path="checkout"
          element={
            <RequirePerm permission="sell">
              <CheckoutPage />
            </RequirePerm>
          }
        />
        <Route
          path="products"
          element={
            <RequirePerm permission="inventory">
              <ProductsPage />
            </RequirePerm>
          }
        />
        <Route
          path="sales"
          element={
            <RequirePerm permission="ledger">
              <SalesPage />
            </RequirePerm>
          }
        />
        <Route
          path="customers"
          element={
            <RequirePerm permission="customers">
              <CustomersPage />
            </RequirePerm>
          }
        />
        <Route
          path="insights"
          element={
            <RequirePerm permission="pulse">
              <InsightsPage />
            </RequirePerm>
          }
        />
        <Route
          path="barcodes"
          element={
            <RequirePerm permission="labels">
              <BarcodesPage />
            </RequirePerm>
          }
        />
        <Route
          path="team"
          element={
            <RequirePerm permission="team">
              <TeamPage />
            </RequirePerm>
          }
        />
        <Route
          path="audit"
          element={
            <RequirePerm permission="team">
              <AuditLogPage />
            </RequirePerm>
          }
        />
        <Route
          path="conflicts"
          element={
            <RequirePerm permission="team">
              <StockConflictsPage />
            </RequirePerm>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="onboarding"
          element={
            <RequirePerm permission="team">
              <OnboardingPage />
            </RequirePerm>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
