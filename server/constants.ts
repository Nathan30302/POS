import { CORE_MODULES, modulesForIndustry } from './industries.js'

/** @deprecated Prefer modulesForIndustry(industry) */
export const DEFAULT_MODULES = { ...CORE_MODULES }

export { modulesForIndustry }
