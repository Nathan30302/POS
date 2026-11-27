import type { SessionUser } from '@/lib/api'

export type BusinessModules = {
  sell: boolean
  inventory: boolean
  finance: boolean
  employees: boolean
  crm: boolean
  procurement: boolean
  intelligence: boolean
  pharmacy: boolean
  perishables: boolean
  labels: boolean
  transfers: boolean
}

export const INDUSTRY_OPTIONS = [
  { id: 'retail', label: 'General retail' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'chemist', label: 'Chemist' },
  { id: 'clinic', label: 'Clinic dispensary' },
  { id: 'grocery', label: 'Grocery / fresh' },
  { id: 'stationery', label: 'Stationery / school' },
  { id: 'general', label: 'Other' },
] as const

export function modulesOf(user: SessionUser | null | undefined): BusinessModules {
  const m = user?.modules
  return {
    sell: m?.sell !== false,
    inventory: m?.inventory !== false,
    finance: m?.finance !== false,
    employees: m?.employees !== false,
    crm: m?.crm !== false,
    procurement: m?.procurement !== false,
    intelligence: m?.intelligence !== false,
    pharmacy: Boolean(m?.pharmacy),
    perishables: Boolean(m?.perishables),
    labels: m?.labels !== false,
    transfers: m?.transfers !== false,
  }
}

export function hasLotModule(user: SessionUser | null | undefined) {
  const m = modulesOf(user)
  return m.pharmacy || m.perishables
}

export function lotNavLabel(user: SessionUser | null | undefined) {
  const m = modulesOf(user)
  if (m.pharmacy) return 'Pharmacy'
  if (m.perishables) return 'Perishables'
  return 'Lots'
}

export function isPharmacyShop(user: SessionUser | null | undefined) {
  return modulesOf(user).pharmacy
}

export const CATEGORIES_BY_INDUSTRY: Record<string, string[]> = {
  retail: [
    'General',
    'Drinks',
    'Snacks',
    'Household',
    'Personal care',
    'Electronics',
    'Apparel',
    'Other',
  ],
  pharmacy: [
    'Analgesics',
    'Antibiotics',
    'Antimalarials',
    'Cough & cold',
    'Vitamins',
    'Dermatology',
    'Diabetes',
    'Hypertension',
    'First aid',
    'OTC',
    'Prescription',
    'General',
  ],
  chemist: [
    'Analgesics',
    'Antibiotics',
    'Antimalarials',
    'Cough & cold',
    'Vitamins',
    'Dermatology',
    'Diabetes',
    'Hypertension',
    'First aid',
    'OTC',
    'Prescription',
    'General',
  ],
  clinic: [
    'Analgesics',
    'Antibiotics',
    'OTC',
    'Prescription',
    'First aid',
    'General',
  ],
  grocery: [
    'Fresh produce',
    'Dairy',
    'Bakery',
    'Meat & fish',
    'Frozen',
    'Dry goods',
    'Beverages',
    'Household',
    'General',
  ],
  stationery: [
    'Writing',
    'Books',
    'Paper',
    'Tools',
    'Adhesives',
    'School',
    'Art',
    'Office',
    'Files',
    'General',
  ],
  general: ['General', 'Other'],
}

export function categoriesForUser(user: SessionUser | null | undefined): string[] {
  const ind = (user?.industry || 'retail').toLowerCase()
  if (CATEGORIES_BY_INDUSTRY[ind]) return CATEGORIES_BY_INDUSTRY[ind]
  if (ind.includes('pharm')) return CATEGORIES_BY_INDUSTRY.pharmacy
  if (ind.includes('groc')) return CATEGORIES_BY_INDUSTRY.grocery
  if (ind.includes('station')) return CATEGORIES_BY_INDUSTRY.stationery
  return CATEGORIES_BY_INDUSTRY.retail
}
