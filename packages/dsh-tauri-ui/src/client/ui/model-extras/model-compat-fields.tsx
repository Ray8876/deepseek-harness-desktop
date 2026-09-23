import type { ReactElement } from 'react'
import type { ModelCompatFieldsProps } from './model-compat-fields.types'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { useMountStyle } from '../../hooks/use-mount-style'
import {
  declaredThinkingLevels,
  enableThinking,
  supportsTemplateThinking,
  supportsThinking,
  templateThinkingCompat,
  THINKING_LEVELS,
  thinkingEffortsOf,
  toggleThinkingLevel,
} from '../../service/model-compat'
import modelCompatFieldsStyle, { MODEL_COMPAT_FIELDS_STYLE_ID } from './model-compat-fields.cssr'

export function ModelCompatFields({
  t,
  model,
  index,
  templateCompat,
  onPatch,
  disabled,
}: ModelCompatFieldsProps): ReactElement {
  useMountStyle(modelCompatFieldsStyle, MODEL_COMPAT_FIELDS_STYLE_ID)
  const position = index + 1
  return (
    <>
      <div className="dshp-model-compat">
        <div className="dshp-model-compat__field">
          <span className="dshp-model-compat__label" title={t('thinkingModeHint')}>{t('thinkingMode')}</span>
          <div className="dshp-model-compat__switch">
            <Switch
              checked={supportsThinking(model)}
              disabled={disabled}
              label={`${t('thinkingMode')} ${String(position)}`}
              title={t('thinkingModeHint')}
              onChange={(next) => { onPatch({ reasoningEfforts: next ? enableThinking(model) : false }) }}
            />
          </div>
        </div>
        {templateCompat
          ? (
              <div className="dshp-model-compat__field">
                <span className="dshp-model-compat__label" title={t('developerRoleHint')}>{t('developerRole')}</span>
                <div className="dshp-model-compat__switch">
                  <Switch
                    checked={supportsTemplateThinking(model)}
                    disabled={disabled}
                    label={`${t('developerRole')} ${String(position)}`}
                    title={t('developerRoleHint')}
                    onChange={(next) => { onPatch({ compat: templateThinkingCompat(model, next) }) }}
                  />
                </div>
              </div>
            )
          : null}
      </div>
      {supportsThinking(model)
        ? (
            <div className="dshp-model-compat__levels" role="group" aria-label={`${t('thinkingLevels')} ${String(position)}`}>
              <span className="dshp-model-compat__label">{t('thinkingLevels')}</span>
              <div className="dshp-model-compat__chips">
                {THINKING_LEVELS.map(level => (
                  <label key={level} className="dshp-model-compat__chip">
                    <input
                      type="checkbox"
                      checked={declaredThinkingLevels(model).includes(level)}
                      disabled={disabled}
                      onChange={(event) => {
                        onPatch({
                          reasoningEfforts: toggleThinkingLevel(
                            thinkingEffortsOf(model),
                            level,
                            event.target.checked,
                          ),
                        })
                      }}
                    />
                    {level}
                  </label>
                ))}
              </div>
            </div>
          )
        : null}
    </>
  )
}
