/**
 * Shop loyalty — earn on completed sales, redeem via discount.
 * Campaign multiplier lives in business.settingsJson.loyalty.
 */

export type LoyaltySettings = {
  enabled: boolean
  /** Points earned per 1 ZMW of sale total (default 1). */
  earnPerKwacha: number
  /** Points required per 1 ZMW off (default 10). */
  redeemPtsPerKwacha: number
  /** Max redeem as fraction of subtotal (default 0.2). */
  maxRedeemFraction: number
  campaign: {
    name: string
    multiplier: number
    endsAt: string | null
  } | null
}

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  earnPerKwacha: 1,
  redeemPtsPerKwacha: 10,
  maxRedeemFraction: 0.2,
  campaign: null,
}

export function parseLoyaltySettings(
  settingsJson: string | null | undefined,
): LoyaltySettings {
  try {
    const root = JSON.parse(settingsJson || '{}') as {
      loyalty?: Partial<LoyaltySettings> & {
        campaign?: LoyaltySettings['campaign']
      }
    }
    const L = root.loyalty || {}
    const campaign =
      L.campaign && L.campaign.name
        ? {
            name: String(L.campaign.name).slice(0, 80),
            multiplier: Math.max(
              1,
              Math.min(5, Number(L.campaign.multiplier) || 1),
            ),
            endsAt: L.campaign.endsAt || null,
          }
        : null
    return {
      enabled: L.enabled !== false,
      earnPerKwacha: Math.max(
        0,
        Math.min(10, Number(L.earnPerKwacha) || 1),
      ),
      redeemPtsPerKwacha: Math.max(
        1,
        Math.min(100, Number(L.redeemPtsPerKwacha) || 10),
      ),
      maxRedeemFraction: Math.max(
        0.05,
        Math.min(0.5, Number(L.maxRedeemFraction) || 0.2),
      ),
      campaign,
    }
  } catch {
    return { ...DEFAULT_LOYALTY }
  }
}

export function activeCampaignMultiplier(settings: LoyaltySettings): {
  multiplier: number
  campaignName: string | null
} {
  const c = settings.campaign
  if (!c || !c.endsAt) {
    return { multiplier: 1, campaignName: null }
  }
  const ends = new Date(c.endsAt)
  if (Number.isNaN(ends.getTime()) || ends.getTime() < Date.now()) {
    return { multiplier: 1, campaignName: null }
  }
  return {
    multiplier: Math.max(1, c.multiplier || 1),
    campaignName: c.name,
  }
}

export function computeEarnPoints(
  total: number,
  settings: LoyaltySettings,
): { points: number; campaignName: string | null } {
  if (!settings.enabled || total <= 0) {
    return { points: 0, campaignName: null }
  }
  const { multiplier, campaignName } = activeCampaignMultiplier(settings)
  const base = Math.floor(total * settings.earnPerKwacha)
  return {
    points: Math.floor(base * multiplier),
    campaignName,
  }
}

/** Cap redeem request against balance and subtotal. */
export function computeRedeem(
  ptsRequested: number,
  balance: number,
  subtotal: number,
  settings: LoyaltySettings,
): { pts: number; kwacha: number } {
  if (!settings.enabled || ptsRequested <= 0 || balance <= 0 || subtotal <= 0) {
    return { pts: 0, kwacha: 0 }
  }
  const pts = Math.min(ptsRequested, balance)
  const kwachaFromPts = Math.floor(pts / settings.redeemPtsPerKwacha)
  const cap = Math.floor(subtotal * settings.maxRedeemFraction)
  const kwacha = Math.max(0, Math.min(kwachaFromPts, cap))
  const ptsUsed = kwacha * settings.redeemPtsPerKwacha
  return { pts: ptsUsed, kwacha }
}
