import type { ModelDiscoveryChannel } from '../../service/model-config'
import type { ModelDraft, ModelProbeTarget } from './model-config-toolbar.types'
import type { Translate } from './types'

export interface ModelFetchConfigButtonProps {
  t: Translate
  modelId: string
  models: readonly ModelDraft[]
  probe: ModelProbeTarget
  operations?: ModelDiscoveryChannel
  disabled?: boolean
  onApply?: (models: ModelDraft[], applied: number, undisclosed: string[]) => void
}
