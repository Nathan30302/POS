/**
 * Filter Guide chapters the same way NexoraShell filters nav:
 * role (Command for cashiers), permissions, and business modules / lots.
 */
import type { SessionUser } from '@/lib/api'
import {
  hasLotModule,
  lotNavLabel,
  modulesOf,
  type BusinessModules,
} from '@/lib/industry'
import {
  canSeeCommand,
  hasPermission,
  type Permission,
} from '@/lib/permissions'
import type { GuideChapter } from '@/lib/operatorGuide'
import type { GlossaryTerm } from '@/lib/guideGlossary'

export type GuideAccessRule = {
  /** Nav permission gate — null means always allowed if module/role pass */
  permission?: Permission | null
  /** Same module keys used by NexoraShell nav */
  module?: keyof BusinessModules | 'lots' | 'always'
  /** Hide for cashier/sales the way Command is hidden */
  requireCommand?: boolean
  /** Chapter only when pharmacy/perishable lots exist */
  requireLots?: boolean
  /** Glossary / chapter tags used for secondary filtering */
  topics?: string[]
}

/** Maps chapter id → access (mirrors NexoraShell link rules). */
export const GUIDE_CHAPTER_ACCESS: Record<string, GuideAccessRule> = {
  daily: { module: 'always', topics: ['daily'] },
  sell: { permission: 'sell', module: 'sell', topics: ['sell'] },
  command: { requireCommand: true, module: 'always', topics: ['command'] },
  inventory: {
    permission: 'inventory',
    module: 'inventory',
    topics: ['inventory', 'stock'],
  },
  pharmacy: {
    permission: 'inventory',
    module: 'lots',
    requireLots: true,
    topics: ['pharmacy', 'lots', 'inventory'],
  },
  transfers: {
    permission: 'transfer_request',
    module: 'transfers',
    topics: ['transfers', 'inventory'],
  },
  purchasing: {
    permission: 'inventory',
    module: 'procurement',
    topics: ['purchasing', 'inventory'],
  },
  suppliers: {
    permission: 'inventory',
    module: 'procurement',
    topics: ['suppliers', 'purchasing'],
  },
  ledger: { permission: 'ledger', module: 'always', topics: ['ledger'] },
  pulse: {
    permission: 'pulse',
    module: 'intelligence',
    topics: ['pulse', 'command'],
  },
  customers: { permission: 'customers', module: 'crm', topics: ['customers'] },
  team: { permission: 'team', module: 'employees', topics: ['team'] },
  expenses: {
    permission: 'expenses',
    module: 'finance',
    topics: ['expenses'],
  },
  audit: { permission: 'team', module: 'employees', topics: ['audit', 'team'] },
  conflicts: {
    permission: 'team',
    module: 'inventory',
    topics: ['conflicts', 'inventory'],
  },
  settings: { module: 'always', topics: ['settings'] },
}

/** Glossary terms → which access topics they belong to (empty = always show). */
export const GLOSSARY_TOPICS: Record<string, string[]> = {
  Sell: ['sell', 'daily'],
  'Cash drawer / float': ['sell', 'daily'],
  'Open shift': ['sell', 'daily'],
  'Close shift': ['sell', 'daily'],
  Complete: ['sell', 'daily'],
  'Catalogue / tile': ['sell'],
  'Scan / barcode': ['sell'],
  'Tender / Exact': ['sell'],
  Discount: ['sell'],
  Void: ['ledger', 'sell'],
  'Manager PIN': ['sell', 'ledger', 'team'],
  Command: ['command'],
  Pulse: ['pulse'],
  Trust: ['command'],
  'Money leaks': ['command', 'pulse'],
  Critical: ['command'],
  Ledger: ['ledger'],
  'Receive (stock)': ['inventory'],
  'Low stock': ['inventory', 'command'],
  Branch: ['transfers', 'settings', 'command'],
  Transfer: ['transfers'],
  Audit: ['audit'],
  Conflicts: ['conflicts'],
  'Queued / offline': ['sell', 'daily'],
  Loyalty: ['customers', 'sell'],
  'Credit sale': ['customers', 'sell'],
  Purchasing: ['purchasing'],
  'Purchase order / PO': ['purchasing'],
  Supplier: ['suppliers', 'purchasing'],
  Pharmacy: ['pharmacy'],
  'Lot / batch': ['pharmacy'],
  FEFO: ['pharmacy'],
  'Rx note': ['pharmacy'],
  Perishables: ['pharmacy'],
  Labels: ['inventory'],
  Expenses: ['expenses'],
  Team: ['team'],
  Permission: ['team'],
  Settings: ['settings'],
}

function moduleAllowed(
  mods: BusinessModules,
  user: SessionUser | null | undefined,
  module: GuideAccessRule['module'],
) {
  if (!module || module === 'always') return true
  if (module === 'lots') return hasLotModule(user)
  return mods[module] !== false
}

export function canAccessGuideChapter(
  chapterId: string,
  user: SessionUser | null | undefined,
): boolean {
  // Public / not logged in → full owner-style overview
  if (!user || user.kind !== 'business') return true

  const rule = GUIDE_CHAPTER_ACCESS[chapterId] || { module: 'always' as const }
  const mods = modulesOf(user)

  if (rule.requireCommand && !canSeeCommand(user.role)) return false
  if (rule.requireLots && !hasLotModule(user)) return false
  if (!moduleAllowed(mods, user, rule.module)) return false

  const needed = rule.permission === undefined ? null : rule.permission
  if (needed !== null && needed !== undefined) {
    if (!hasPermission(user.permissions, user.role, needed)) return false
  }
  return true
}

export function filterGuideChapters(
  chapters: GuideChapter[],
  user: SessionUser | null | undefined,
): GuideChapter[] {
  const visible = chapters.filter((c) => canAccessGuideChapter(c.id, user))
  return visible.map((c) => adaptChapterForUser(c, user))
}

export function filterGuideGlossary(
  terms: GlossaryTerm[],
  user: SessionUser | null | undefined,
  visibleChapterIds: string[],
): GlossaryTerm[] {
  if (!user || user.kind !== 'business') return terms
  const topicSet = new Set<string>()
  for (const id of visibleChapterIds) {
    const rule = GUIDE_CHAPTER_ACCESS[id]
    rule?.topics?.forEach((t) => topicSet.add(t))
  }
  // Always keep core till words if Sell is visible
  if (topicSet.has('sell')) {
    topicSet.add('daily')
  }
  return terms.filter((t) => {
    const topics = GLOSSARY_TOPICS[t.term]
    if (!topics || topics.length === 0) return true
    return topics.some((x) => topicSet.has(x))
  })
}

/** Soften owner-only day steps when the role cannot open those screens. */
function adaptChapterForUser(
  chapter: GuideChapter,
  user: SessionUser | null | undefined,
): GuideChapter {
  if (!user || user.kind !== 'business') {
    if (chapter.id === 'pharmacy') {
      return {
        ...chapter,
        title: 'Pharmacy / perishable lots',
      }
    }
    return chapter
  }

  if (chapter.id === 'pharmacy') {
    return {
      ...chapter,
      title: lotNavLabel(user),
    }
  }

  if (chapter.id !== 'daily') return chapter
  if (canSeeCommand(user.role)) return chapter

  // Cashier / sales day loop — no Command / Trust homework
  return {
    ...chapter,
    who: 'Your role · till day',
    purpose:
      'One full day on the till: morning open → sell → evening close. Follow the clicks for your role.',
    voice:
      'Here is a normal day for your login. Morning: sign in. Open Sell, type the opening float — that is the money already in the drawer — then tap Open shift. During the day stay on Sell: scan or tap products, choose payment, tap Complete. If Wi‑Fi dies, the sale can queue — do not type it again. If you made a mistake after Complete and you can open Ledger, void with a reason, or ask a manager. Evening: on Sell, close the shift and count the drawer. That is your whole loop.',
    clicks: chapter.clicks.filter(
      (c) => !/Command|Money leaks|Trust|Pulse/i.test(c),
    ),
    parts: chapter.parts.filter((p) => !/Command|Pulse|owner/i.test(p.name + p.meaning)),
    tip: 'Ask a manager before voids or big discounts if the app asks for a Manager PIN.',
  }
}

export function guideAudienceLabel(user: SessionUser | null | undefined): string {
  if (!user || user.kind !== 'business') {
    return 'Full shop overview — every major screen'
  }
  if (canSeeCommand(user.role)) {
    return `Showing screens your ${user.role?.toLowerCase() || 'role'} can open`
  }
  return 'Showing only the screens your login can open'
}
