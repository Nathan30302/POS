/**
 * Business industry → modules, catalogue presets, and UI labels.
 * Every shop shares Sell/Inventory core; add-ons (pharmacy lots, etc.) are gated.
 */

export type IndustryId =
  | 'retail'
  | 'pharmacy'
  | 'chemist'
  | 'clinic'
  | 'grocery'
  | 'stationery'
  | 'general'

export type BusinessModules = {
  sell: boolean
  inventory: boolean
  finance: boolean
  employees: boolean
  crm: boolean
  procurement: boolean
  intelligence: boolean
  /** Lot / expiry / FEFO / Rx */
  pharmacy: boolean
  /** Same lot engine, grocery-facing labels */
  perishables: boolean
  labels: boolean
  transfers: boolean
}

export const CORE_MODULES: BusinessModules = {
  sell: true,
  inventory: true,
  finance: true,
  employees: true,
  crm: true,
  procurement: true,
  intelligence: true,
  pharmacy: false,
  perishables: false,
  labels: true,
  transfers: true,
}

export const INDUSTRY_OPTIONS: Array<{
  id: IndustryId
  label: string
  blurb: string
}> = [
  {
    id: 'retail',
    label: 'General retail',
    blurb: 'Counter sell, stock, customers, Pulse',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    blurb: 'Lots, expiry, FEFO, Rx dispense notes',
  },
  {
    id: 'chemist',
    label: 'Chemist',
    blurb: 'Same as pharmacy — lot & Rx controls',
  },
  {
    id: 'clinic',
    label: 'Clinic dispensary',
    blurb: 'Dispense with lots and Rx notes',
  },
  {
    id: 'grocery',
    label: 'Grocery / fresh',
    blurb: 'Perishable lots & expiry (no Rx)',
  },
  {
    id: 'stationery',
    label: 'Stationery / school',
    blurb: 'Catalogue presets for pens, paper, school',
  },
  {
    id: 'general',
    label: 'Other',
    blurb: 'Core shop OS without specialty add-ons',
  },
]

export function normalizeIndustry(raw: string | null | undefined): IndustryId {
  const s = (raw || 'retail').toLowerCase().trim()
  if (s.includes('pharm')) return 'pharmacy'
  if (s.includes('chemist') || s.includes('drugstore')) return 'chemist'
  if (s.includes('clinic') || s.includes('dispens')) return 'clinic'
  if (s.includes('groc') || s.includes('super') || s.includes('fresh')) {
    return 'grocery'
  }
  if (s.includes('station') || s.includes('school') || s.includes('book')) {
    return 'stationery'
  }
  if (s === 'general' || s === 'other') return 'general'
  return 'retail'
}

export function modulesForIndustry(industry: string): BusinessModules {
  const id = normalizeIndustry(industry)
  const base = { ...CORE_MODULES }
  if (id === 'pharmacy' || id === 'chemist' || id === 'clinic') {
    return { ...base, pharmacy: true, perishables: false }
  }
  if (id === 'grocery') {
    return { ...base, pharmacy: false, perishables: true }
  }
  return base
}

export function hasLotModule(modules: Partial<BusinessModules> | null | undefined) {
  return Boolean(modules?.pharmacy || modules?.perishables)
}

export function parseModulesJson(
  json: string | null | undefined,
  industry?: string,
): BusinessModules {
  const fallback = modulesForIndustry(industry || 'retail')
  try {
    const raw = JSON.parse(json || '{}') as Partial<BusinessModules>
    return {
      ...fallback,
      ...raw,
      // Industry always wins for specialty flags if industry says so
      pharmacy: fallback.pharmacy || Boolean(raw.pharmacy),
      perishables: fallback.perishables || Boolean(raw.perishables),
    }
  } catch {
    return fallback
  }
}

export const RETAIL_CATEGORIES = [
  'General',
  'Drinks',
  'Snacks',
  'Household',
  'Personal care',
  'Electronics',
  'Apparel',
  'Other',
] as const

export const STATIONERY_CATEGORIES = [
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
] as const

export const GROCERY_CATEGORIES = [
  'Fresh produce',
  'Dairy',
  'Bakery',
  'Meat & fish',
  'Frozen',
  'Dry goods',
  'Beverages',
  'Household',
  'General',
] as const

export const PHARMACY_CATEGORIES = [
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
] as const

export function categoriesForIndustry(industry: string): string[] {
  const id = normalizeIndustry(industry)
  if (id === 'pharmacy' || id === 'chemist' || id === 'clinic') {
    return [...PHARMACY_CATEGORIES]
  }
  if (id === 'grocery') return [...GROCERY_CATEGORIES]
  if (id === 'stationery') return [...STATIONERY_CATEGORIES]
  return [...RETAIL_CATEGORIES]
}

export function lotNavLabel(modules: Partial<BusinessModules>): string {
  if (modules.pharmacy) return 'Pharmacy'
  if (modules.perishables) return 'Perishables'
  return 'Lots'
}

/** Settings payload helpers when industry changes. */
export function settingsForIndustry(
  industry: string,
  currentSettings: Record<string, unknown> = {},
): Record<string, unknown> {
  const id = normalizeIndustry(industry)
  const pharmacyOn = id === 'pharmacy' || id === 'chemist' || id === 'clinic'
  const perishablesOn = id === 'grocery'
  return {
    ...currentSettings,
    pharmacy: {
      enabled: pharmacyOn,
      warnDays: 90,
      rxRequired: pharmacyOn,
    },
    perishables: {
      enabled: perishablesOn,
      warnDays: 14,
    },
  }
}
