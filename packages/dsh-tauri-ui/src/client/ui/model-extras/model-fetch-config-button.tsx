import type { ReactElement } from 'react'
import type { ModelFetchConfigButtonProps } from './model-fetch-config-button.types'
import { useMountStyle } from '../../hooks/use-mount-style'
import { hasModelConfig } from '../../service/model-config.utils'
import modelExtrasStyle, { MODEL_EXTRAS_STYLE_ID } from './model-extras.cssr'
import { useModelConfigFetch } from './use-model-config-fetch'

export function ModelFetchConfigButton({
  t,
  modelId,
  models,
  probe,
  operations,
  disabled,
  onApply,
}: ModelFetchConfigButtonProps): ReactElement | null {
  useMountStyle(modelExtrasStyle, MODEL_EXTRAS_STYLE_ID)
  const { busy, failure, run } = useModelConfigFetch({ t, models, probe, operations, onApply })
  const row = models.find(model => model.id === modelId)
  if (row !== undefined && hasModelConfig(row))
    return null

  return (
    <div className="dshp-model-extras__row">
      <button
        type="button"
        className="dshp-model-extras__link"
        disabled={disabled === true || busy}
        title={t('fetchModelConfigHint')}
        aria-busy={busy}
        onClick={() => run([modelId])}
      >
        {busy ? t('fetchingConfig') : t('fetchModelConfig')}
      </button>
      {failure === undefined ? null : <p className="dshp-model-extras__notice dshp-model-extras__notice--failed" role="alert">{failure}</p>}
    </div>
  )
}
