import type { Config } from './config/onboarding'
import type { HostContext } from './types'
import { PLUGIN_ID } from '../shared/constants'
import { ONBOARDING_CONFIG_GLOBAL } from '../shared/onboarding-config'

const INDEX_EFFECT = `${PLUGIN_ID}: onboarding config global`

export function apply(ctx: HostContext, config?: Config): void {
  ctx.effect(() => ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: ONBOARDING_CONFIG_GLOBAL,
      value: { credentialOnboarding: config?.credentialOnboarding ?? true },
    })
  }), INDEX_EFFECT)
}
