import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { Request } from 'express'
import type { MembershipRole } from '@prisma/client'

export type TokenPayload = {
  sub: string
  kind: 'platform' | 'business'
  email: string
  fullName: string
  role?: string
  businessId?: string
  businessName?: string
  membershipId?: string
}

export type AuthRequest = Request & {
  auth?: TokenPayload
  user?: TokenPayload
  businessId?: string
  branchId?: string
  /** Head Office / all-branches scope (X-Branch-Id: __all__). */
  orgView?: boolean
  membershipRole?: MembershipRole | string
  /** Effective permissions from live membership (set by requirePermission / member load). */
  permissions?: string[]
  membershipId?: string
}

const secret = () => {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(value)
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: TokenPayload, expiresIn = '7d') {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret())
  return payload as unknown as TokenPayload
}
