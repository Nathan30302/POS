import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  type AuthedRequest,
} from '../middleware.js'
import {
  modulesForIndustry,
  settingsForIndustry,
} from '../industries.js'
import { prisma } from '../prisma.js'

export const onboardingRouter = Router()
onboardingRouter.use(requireAuth, requireBusinessMember, requireManager)

onboardingRouter.post('/complete', async (req: AuthedRequest, res) => {
  const body = z
    .object({
      name: z.string().min(2).optional(),
      industry: z.string().optional(),
      currency: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      modules: z.record(z.string(), z.boolean()).optional(),
      paymentMethods: z.array(z.string()).optional(),
    })
    .safeParse(req.body)

  if (!body.success) return res.status(400).json({ error: 'Invalid onboarding data' })

  const current = await prisma.business.findUnique({
    where: { id: req.businessId! },
  })
  if (!current) return res.status(404).json({ error: 'Business not found' })

  const industry = body.data.industry ?? current.industry
  const settings = settingsForIndustry(industry, {
    ...JSON.parse(current.settingsJson || '{}'),
    ...(body.data.paymentMethods
      ? { paymentMethods: body.data.paymentMethods }
      : {}),
    onboardedAt: new Date().toISOString(),
  })

  const business = await prisma.business.update({
    where: { id: current.id },
    data: {
      name: body.data.name ?? current.name,
      industry,
      currency: body.data.currency ?? current.currency,
      phone: body.data.phone ?? current.phone,
      address: body.data.address ?? current.address,
      modulesJson: body.data.modules
        ? JSON.stringify({
            ...modulesForIndustry(industry),
            ...body.data.modules,
          })
        : JSON.stringify(modulesForIndustry(industry)),
      settingsJson: JSON.stringify(settings),
      status: 'ACTIVE',
    },
  })

  res.json({
    business: {
      ...business,
      modules: JSON.parse(business.modulesJson || '{}'),
      settings: JSON.parse(business.settingsJson || '{}'),
    },
  })
})
