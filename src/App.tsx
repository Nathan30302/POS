import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { BarcodesPage } from '@/pages/BarcodesPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PhoneScannerPage } from '@/pages/PhoneScannerPage'
import { CheckoutPage } from '@/pages/checkout/CheckoutPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { useRole } from '@/hooks/useRole'

function OwnerOnly({ children }: { children: ReactNode }) {
  const { isOwner } = useRole()
  if (!isOwner) return <Navigate to="/checkout" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Standalone phone scanner — no sidebar chrome */}
      <Route path="/phone-scan/:roomId" element={<PhoneScannerPage />} />

      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/checkout" replace />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/barcodes" element={<BarcodesPage />} />
        <Route
          path="/dashboard"
          element={
            <OwnerOnly>
              <DashboardPage />
            </OwnerOnly>
          }
        />
        <Route
          path="/sales"
          element={
            <OwnerOnly>
              <SalesPage />
            </OwnerOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/checkout" replace />} />
    </Routes>
  )
}
