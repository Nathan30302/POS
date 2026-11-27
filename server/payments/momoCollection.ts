/**
 * MTN MoMo Collection — request-to-pay + status poll.
 * Uses sandbox or production base URL from env.
 * Without keys, callers fall back to manual agent path.
 */

export type MomoConfig = {
  subscriptionKey: string
  apiUser: string
  apiKey: string
  targetEnvironment: string
  baseUrl: string
  callbackHost: string | null
}

export function loadMomoConfig(): MomoConfig | null {
  const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY?.trim()
  const apiUser = process.env.MOMO_API_USER?.trim()
  const apiKey = process.env.MOMO_API_KEY?.trim()
  if (!subscriptionKey || !apiUser || !apiKey) return null

  const targetEnvironment =
    process.env.MOMO_TARGET_ENV?.trim() || 'sandbox'
  const baseUrl =
    process.env.MOMO_BASE_URL?.trim() ||
    (targetEnvironment === 'production'
      ? 'https://proxy.momoapi.mtn.com'
      : 'https://sandbox.momodeveloper.mtn.com')

  return {
    subscriptionKey,
    apiUser,
    apiKey,
    targetEnvironment,
    baseUrl: baseUrl.replace(/\/$/, ''),
    callbackHost: process.env.MOMO_CALLBACK_HOST?.trim() || null,
  }
}

function basicAuth(user: string, key: string) {
  return `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`
}

async function getAccessToken(cfg: MomoConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(cfg.apiUser, cfg.apiKey),
      'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`MoMo token failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('MoMo token missing access_token')
  return data.access_token
}

function normalizeMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('260')) return digits
  if (digits.startsWith('0') && digits.length === 10) {
    return `260${digits.slice(1)}`
  }
  if (digits.length === 9) return `260${digits}`
  return digits
}

export type RequestToPayInput = {
  amount: number
  currency: string
  phone: string
  externalId: string
  payerMessage?: string
  payeeNote?: string
}

export type RequestToPayResult = {
  referenceId: string
  status: 'pending' | 'failed'
  message: string
}

export async function requestToPay(
  input: RequestToPayInput,
): Promise<RequestToPayResult> {
  const cfg = loadMomoConfig()
  if (!cfg) {
    return {
      referenceId: '',
      status: 'failed',
      message: 'MoMo Collection keys not configured',
    }
  }

  const referenceId = crypto.randomUUID()
  const token = await getAccessToken(cfg)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Reference-Id': referenceId,
    'X-Target-Environment': cfg.targetEnvironment,
    'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
    'Content-Type': 'application/json',
  }
  if (cfg.callbackHost) {
    headers['X-Callback-Url'] =
      `${cfg.callbackHost.replace(/\/$/, '')}/api/payments/webhooks/mtn_momo`
  }

  const body = {
    amount: String(Number(input.amount.toFixed(2))),
    currency: input.currency || 'ZMW',
    externalId: input.externalId.slice(0, 64),
    payer: {
      partyIdType: 'MSISDN',
      partyId: normalizeMsisdn(input.phone),
    },
    payerMessage: (input.payerMessage || 'NEXORA shop').slice(0, 100),
    payeeNote: (input.payeeNote || 'Sale payment').slice(0, 100),
  }

  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  // 202 Accepted = pending customer approval
  if (res.status === 202 || res.status === 200) {
    return {
      referenceId,
      status: 'pending',
      message: 'MoMo request-to-pay sent — waiting for customer approval',
    }
  }

  const text = await res.text().catch(() => '')
  return {
    referenceId,
    status: 'failed',
    message: `MoMo request-to-pay failed (${res.status}): ${text.slice(0, 180)}`,
  }
}

export type MomoStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'unknown'

export async function getRequestToPayStatus(
  referenceId: string,
): Promise<{ status: MomoStatus; raw?: string }> {
  const cfg = loadMomoConfig()
  if (!cfg) return { status: 'unknown' }

  const token = await getAccessToken(cfg)
  const res = await fetch(
    `${cfg.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': cfg.targetEnvironment,
        'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
      },
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { status: 'unknown', raw: text.slice(0, 200) }
  }

  const data = (await res.json()) as { status?: string }
  const s = (data.status || '').toUpperCase()
  if (s === 'SUCCESSFUL') return { status: 'confirmed', raw: s }
  if (s === 'PENDING') return { status: 'pending', raw: s }
  if (s === 'FAILED') return { status: 'failed', raw: s }
  if (s === 'TIMEOUT' || s === 'REJECTED') return { status: 'cancelled', raw: s }
  return { status: 'unknown', raw: s }
}

export function momoKeysPresent(): boolean {
  return loadMomoConfig() !== null
}
