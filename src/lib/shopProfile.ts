import { api } from '@/lib/api'

export type ShopReceiptProfile = {
  name: string
  phone?: string
  address?: string
  currency: string
  mtnAgentNumber?: string
  mtnAgentCode?: string
  airtelAgentNumber?: string
  airtelAgentCode?: string
}

type BusinessMe = {
  business: {
    name: string
    phone?: string | null
    address?: string | null
    currency?: string
    settings?: Record<string, unknown>
  }
}

function readSetting(settings: Record<string, unknown> | undefined, key: string) {
  const value = settings?.[key]
  return typeof value === 'string' ? value : ''
}

export async function fetchShopProfile(): Promise<ShopReceiptProfile> {
  const data = await api<BusinessMe>('/business/me')
  const settings = data.business.settings || {}
  return {
    name: data.business.name || 'NEXORA Shop',
    phone: data.business.phone || undefined,
    address: data.business.address || undefined,
    currency: data.business.currency || 'ZMW',
    mtnAgentNumber: readSetting(settings, 'mtnAgentNumber') || undefined,
    mtnAgentCode: readSetting(settings, 'mtnAgentCode') || undefined,
    airtelAgentNumber: readSetting(settings, 'airtelAgentNumber') || undefined,
    airtelAgentCode: readSetting(settings, 'airtelAgentCode') || undefined,
  }
}
