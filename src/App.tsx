import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { NexoraShell } from '@/components/layout/NexoraShell'
import { RequireLotModule } from '@/components/RequireLotModule'
import { RequirePerm } from '@/components/RequirePerm'
import { useAuth } from '@/context/AuthContext'
import { businessHomePath, canSeeCommand } from '@/lib/permissions'
import { GuidePage } from '@/pages/GuidePage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { PlatformLoginPage } from '@/pages/platform/PlatformLoginPage'
import { SignupPage } from '@/pages/SignupPage'

/** Heavy app routes — code-split so Sell/Login stay lean on first paint. */
const CheckoutPage = lazy(() =>
  import('@/pages/checkout/CheckoutPage').then((m) => ({
    default: m.CheckoutPage,
  })),
)
const ProductsPage = lazy(() =>
  import('@/pages/products/ProductsPage').then((m) => ({
    default: m.ProductsPage,
  })),
)
const PharmacyPage = lazy(() =>
  import('@/pages/PharmacyPage').then((m) => ({
    default: m.PharmacyPage,
  })),
)
const TransfersPage = lazy(() =>
  import('@/pages/TransfersPage').then((m) => ({
    default: m.TransfersPage,
  })),
)
const PurchasingPage = lazy(() =>
  import('@/pages/PurchasingPage').then((m) => ({
    default: m.PurchasingPage,
  })),
)
const SuppliersPage = lazy(() =>
  import('@/pages/SuppliersPage').then((m) => ({
    default: m.SuppliersPage,
  })),
)
const ExpensesPage = lazy(() =>
  import('@/pages/ExpensesPage').then((m) => ({
    default: m.ExpensesPage,
  })),
)
const SalesPage = lazy(() =>
  import('@/pages/sales/SalesPage').then((m) => ({ default: m.SalesPage })),
)
const OwnerDashboardPage = lazy(() =>
  import('@/pages/OwnerDashboardPage').then((m) => ({
    default: m.OwnerDashboardPage,
  })),
)
const InsightsPage = lazy(() =>
  import('@/pages/InsightsPage').then((m) => ({ default: m.InsightsPage })),
)
const CustomersPage = lazy(() =>
  import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })),
)
const BarcodesPage = lazy(() =>
  import('@/pages/BarcodesPage').then((m) => ({ default: m.BarcodesPage })),
)
const TeamPage = lazy(() =>
  import('@/pages/TeamPage').then((m) => ({ default: m.TeamPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AuditLogPage = lazy(() =>
  import('@/pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
)
const StockConflictsPage = lazy(() =>
  import('@/pages/StockConflictsPage').then((m) => ({
    default: m.StockConflictsPage,
  })),
)
const OnboardingPage = lazy(() =>
  import('@/pages/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
)
const PlatformHomePage = lazy(() =>
  import('@/pages/platform/PlatformHomePage').then((m) => ({
    default: m.PlatformHomePage,
  })),
)
const ScanBenchPage = lazy(() =>
  import('@/pages/ScanBenchPage').then((m) => ({ default: m.ScanBenchPage })),
)
const PhoneScannerPage = lazy(() =>
  import('@/pages/PhoneScannerPage').then((m) => ({
    default: m.PhoneScannerPage,
  })),
)

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-1 py-2 sm:py-3" aria-busy>
      <div className="nx-skeleton h-[5.5rem] rounded-[20px]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="nx-skeleton h-16 rounded-xl" />
        <div className="nx-skeleton h-16 rounded-xl" />
        <div className="nx-skeleton h-16 rounded-xl" />
      </div>
      <div className="nx-skeleton h-64 rounded-[18px]" />
      <p className="sr-only">Loading page…</p>
    </div>
  )
}

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg space-y-3 px-4 py-16 text-center">
          <p className="font-display text-lg font-bold text-ink">
            This screen hit a snag
          </p>
          <p className="text-sm text-ink-soft">
            {this.state.error.message || 'Something went wrong loading this page.'}
          </p>
          <button
            type="button"
            className="rounded-xl bg-royal px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Lazy({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}

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
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-br from-royal to-teal text-sm font-bold text-white shadow-md shadow-royal/25"
          aria-hidden
        >
          NX
        </div>
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-royal/25 border-t-royal"
          aria-hidden
        />
        <p className="text-sm text-ink-soft" role="status">
          Opening your shop OS…
        </p>
      </div>
    )
  }
  if (!user) {
    return (
      <Navigate
        to={kind === 'platform' ? '/platform/login' : '/login'}
        replace
      />
    )
  }
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
  return (
    <Lazy>
      <OwnerDashboardPage />
    </Lazy>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {import.meta.env.DEV ? (
        <Route
          path="/scan-bench"
          element={
            <Lazy>
              <ScanBenchPage />
            </Lazy>
          }
        />
      ) : null}
      <Route
        path="/phone-scan/:roomId"
        element={
          <Lazy>
            <PhoneScannerPage />
          </Lazy>
        }
      />

      <Route
        path="/platform"
        element={
          <Guard kind="platform">
            <Lazy>
              <PlatformHomePage />
            </Lazy>
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
              <Lazy>
                <CheckoutPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="products"
          element={
            <RequirePerm permission="inventory">
              <Lazy>
                <ProductsPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="pharmacy"
          element={
            <RequirePerm permission="inventory">
              <RequireLotModule>
                <Lazy>
                  <PharmacyPage />
                </Lazy>
              </RequireLotModule>
            </RequirePerm>
          }
        />
        <Route
          path="transfers"
          element={
            <RequirePerm permission="transfer_request">
              <Lazy>
                <TransfersPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="purchasing"
          element={
            <RequirePerm permission="inventory">
              <Lazy>
                <PurchasingPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="suppliers"
          element={
            <RequirePerm permission="inventory">
              <Lazy>
                <SuppliersPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="expenses"
          element={
            <RequirePerm permission="expenses">
              <Lazy>
                <ExpensesPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="sales"
          element={
            <RequirePerm permission="ledger">
              <Lazy>
                <SalesPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="customers"
          element={
            <RequirePerm permission="customers">
              <Lazy>
                <CustomersPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="insights"
          element={
            <RequirePerm permission="pulse">
              <Lazy>
                <InsightsPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="barcodes"
          element={
            <RequirePerm permission="labels">
              <Lazy>
                <BarcodesPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="team"
          element={
            <RequirePerm permission="team">
              <Lazy>
                <TeamPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="audit"
          element={
            <RequirePerm permission="team">
              <Lazy>
                <AuditLogPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="conflicts"
          element={
            <RequirePerm permission="team">
              <Lazy>
                <StockConflictsPage />
              </Lazy>
            </RequirePerm>
          }
        />
        <Route
          path="guide"
          element={<GuidePage embedded />}
        />
        <Route
          path="settings"
          element={
            <Lazy>
              <SettingsPage />
            </Lazy>
          }
        />
        <Route
          path="onboarding"
          element={
            <RequirePerm permission="team">
              <Lazy>
                <OnboardingPage />
              </Lazy>
            </RequirePerm>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
