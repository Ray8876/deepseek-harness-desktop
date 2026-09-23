import type { ConnectionHost, HostContext } from './types'
import { PLUGIN_ID } from '../shared/constants'
import { clearHostRuntime, setCurrentHostInstance } from './config/runtime'
import { gate } from './service/gate'

const GATE_EFFECT = `${PLUGIN_ID}: gate`

const HOST_RUNTIME_EFFECT = `${PLUGIN_ID}: host runtime`

export function apply(ctx: HostContext): void {
  setCurrentHostInstance(ctx as unknown as ConnectionHost)

  ctx.effect(() => gate.attach(), GATE_EFFECT)
  ctx.effect(() => () => clearHostRuntime(), HOST_RUNTIME_EFFECT)
}
