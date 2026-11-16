import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { NexoraShell } from '@/components/layout/NexoraShell'
import { useAuth } from '@/context/AuthContext'
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
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">
        Loading NEXORA…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (kind && user.kind !== kind) {
    return (
      <Navigate
        to={user.kind === 'platform' ? '/platform' : '/app/dashboard'}
        replace
      />
    )
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
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
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<OwnerDashboardPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="barcodes" element={<BarcodesPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
