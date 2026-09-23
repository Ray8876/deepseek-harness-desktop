import type { ReactNode } from 'react'
import type { LlmDiscoveredModel } from '../types/remotes.ts'
import type { DeepSeekModelDraft } from './DeepSeekModelsEditor.tsx'
import type { en } from './locales.ts'
import type { ModelsOperations } from './operations.ts'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { AutoConfigAllButton, ModelCompatFields, modelExtrasTranslate, ModelFetchConfigButton, Plus, TEMPLATE_COMPAT_PROTOCOL } from 'dsh-tauri-ui/client'
import { useEffect, useMemo, useState } from 'react'
import { formatCapacity, parseCapacity } from './DeepSeekModelsEditor.tsx'
import { ModelRow } from './ModelRow.tsx'
import { modelStyles as styles } from './styles.ts'

export type ModelDraft = DeepSeekModelDraft

function textOf(model: ModelDraft, key: string): string {
  const value = model[key]
  return typeof value === 'string' ? value : ''
}

function numberOf(model: ModelDraft, key: string): number | undefined {
  const value = model[key]
  return typeof value === 'number' ? value : undefined
}

export interface ProbeTarget {
  settingsNs: string
  provider?: string
  baseURL?: string
  api?: string
  apiKey?: string
}

export interface ModelListEditorProps {
  models: readonly ModelDraft[]
  catalogProvider?: string | undefined
  defaultInput?: readonly string[] | undefined
  overridden?: boolean
  onChange: (models: ModelDraft[]) => void
  onReset?: () => void
  probe: ProbeTarget
  probeBlocked?: keyof typeof en | undefined
  operations: ModelsOperations
  t: (key: keyof typeof en) => string
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}

type CapacityField = 'contextWindow' | 'maxTokens'

const CAPACITY_HINT: Readonly<Record<CapacityField, string>> = {
  contextWindow: '256K',
  maxTokens: '32K',
}

function capacitySpelling(value: number | undefined): string {
  return value === undefined ? '' : formatCapacity(value)
}

function adopt(candidate: LlmDiscoveredModel): ModelDraft {
  return {
    id: candidate.id,
    ...candidate.name === undefined ? {} : { name: candidate.name },
    ...candidate.contextWindow === undefined ? {} : { contextWindow: candidate.contextWindow },
    ...candidate.maxTokens === undefined ? {} : { maxTokens: candidate.maxTokens },
    ...candidate.inputModalities === undefined ? {} : { input: [...candidate.inputModalities] },
  }
}

export function ModelListEditor(props: ModelListEditorProps): ReactNode {
  const { models, onChange, probe, operations, t, disabled, onBusyChange } = props
  const { catalogProvider } = props
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    onBusyChange(busy)
  }, [busy, onBusyChange])
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [inheritedCatalog, setInheritedCatalog] = useState<{
    provider: string
    models: readonly LlmDiscoveredModel[]
  } | undefined>(undefined)
  useEffect(() => {
    if (catalogProvider === undefined)
      return
    let current = true
    void operations.discoverModels(probe.settingsNs, { provider: catalogProvider }).then((answer) => {
      if (!current)
        return
      setInheritedCatalog({ provider: catalogProvider, models: answer.kind === 'found' ? answer.models : [] })
      setFailure(answer.kind === 'refused' ? answer.message : undefined)
    })
    return () => {
      current = false
    }
  }, [catalogProvider, operations, probe.settingsNs])
  const catalog = inheritedCatalog?.provider === catalogProvider ? inheritedCatalog?.models : undefined
  const inputDefaults = useMemo(() => new Map(catalog?.map(model => [model.id, model.inputModalities])), [catalog])
  const [candidates, setCandidates] = useState<readonly LlmDiscoveredModel[] | undefined>(undefined)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [candidateQuery, setCandidateQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())

  const [editing, setEditing] = useState<ReadonlyMap<string, string>>(new Map())

  const bufferKey = (index: number, field: CapacityField): string => `${String(index)}:${field}`

  const capacityText = (model: ModelDraft, index: number, field: CapacityField): string =>
    editing.get(bufferKey(index, field)) ?? capacitySpelling(numberOf(model, field))

  const reindexOnRemove = (
    current: ReadonlyMap<string, string>,
    index: number,
  ): Map<string, string> => {
    const next = new Map<string, string>()
    for (const [key, value] of current) {
      const at = Number(key.slice(0, key.indexOf(':')))
      if (at === index)
        continue

      next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, value)
    }
    return next
  }

  const toggleExpanded = (index: number): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(index))
        next.add(index)
      return next
    })
  }

  const patch = (index: number, next: Record<string, unknown>): void => {
    onChange(models.map((model, at) => {
      if (at !== index)
        return model

      const cleared = new Set(
        Object.entries(next).filter(([, value]) => value === undefined || value === '').map(([key]) => key),
      )
      return Object.fromEntries(
        Object.entries({ ...model, ...next }).filter(([key]) => !cleared.has(key)),
      )
    }))
  }

  const editCapacity = (index: number, field: CapacityField, text: string): void => {
    setEditing(current => new Map(current).set(bufferKey(index, field), text))
    patch(index, { [field]: parseCapacity(text) })
  }

  const fetchModels = async (): Promise<void> => {
    setBusy(true)
    setFailure(undefined)
    try {
      const answer = await operations.discoverModels(probe.settingsNs, {
        ...probe.provider === undefined ? {} : { provider: probe.provider },
        ...probe.baseURL === undefined || probe.baseURL.length === 0 ? {} : { baseURL: probe.baseURL },
        ...probe.api === undefined ? {} : { api: probe.api },
        ...probe.apiKey === undefined ? {} : { apiKey: probe.apiKey },
      })
      if (answer.kind === 'refused') {
        setFailure(answer.message)
        return
      }
      const found = answer.models
      if (catalogProvider !== undefined)
        setInheritedCatalog({ provider: catalogProvider, models: found })
      if (found.length === 0) {
        setFailure(t('fetchEmpty'))
        return
      }

      const known = new Set(models.map(model => textOf(model, 'id')))
      setCandidateQuery('')
      setCandidates(found)
      setPicked(new Set(found.filter(model => !known.has(model.id)).map(model => model.id)))
    }
    finally {
      setBusy(false)
    }
  }

  const closePicker = (): void => {
    setCandidates(undefined)
    setPicked(new Set())
    setCandidateQuery('')
  }

  const adoptPicked = (): void => {
    if (candidates === undefined)
      return
    const byId = new Map(models.map(model => [textOf(model, 'id'), model]))
    for (const candidate of candidates) {
      if (!picked.has(candidate.id))
        continue

      byId.set(candidate.id, byId.get(candidate.id) ?? adopt(candidate))
    }
    onChange([...byId.values()])
    closePicker()
  }

  const toggle = (id: string): void => {
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id))
        next.add(id)
      return next
    })
  }

  const activeCandidates = candidates ?? []
  const normalizedCandidateQuery = candidateQuery.trim().toLowerCase()
  const visibleCandidates = normalizedCandidateQuery.length === 0
    ? activeCandidates
    : activeCandidates.filter(candidate => candidate.id.toLowerCase().includes(normalizedCandidateQuery)
      || candidate.name?.toLowerCase().includes(normalizedCandidateQuery) === true)
  const allVisibleCandidatesPicked = visibleCandidates.length > 0
    && visibleCandidates.every(candidate => picked.has(candidate.id))

  const toggleVisibleCandidates = (): void => {
    setPicked((current) => {
      if (visibleCandidates.every(candidate => current.has(candidate.id))) {
        return new Set()
      }
      const next = new Set(current)
      for (const candidate of visibleCandidates) next.add(candidate.id)
      return next
    })
  }

  const askable = probe.provider !== undefined || (probe.baseURL !== undefined && probe.baseURL.length > 0)
  const target = {
    settingsNs: probe.settingsNs,
    profilePath: [],
    ...probe.provider === undefined ? {} : { provider: probe.provider },
    ...probe.baseURL === undefined ? {} : { baseURL: probe.baseURL },
    ...probe.api === undefined ? {} : { api: probe.api },
    ...probe.apiKey === undefined ? {} : { apiKey: probe.apiKey },
  }
  return (
    <section className={styles.modelCatalog} aria-label={t('models')}>
      <div className={styles.modelListHead}>
        <div className={styles.modelCatalogHeading}>
          <span className={styles.modelCatalogTitle}>{t('models')}</span>
          {props.overridden === undefined
            ? null
            : (
                <span className={styles.modelCatalogMeta}>
                  {props.overridden ? t('modelsCustomized') : t('modelsInherited')}
                </span>
              )}
        </div>
        {props.overridden === true && props.onReset !== undefined
          ? (
              <button
                type="button"
                className={styles.linkButton}
                disabled={disabled}
                onClick={props.onReset}
              >
                {t('resetModels')}
              </button>
            )
          : null}
        <button
          type="button"
          className={styles.linkButton}
          disabled={disabled || busy || !askable || props.probeBlocked !== undefined}
          title={props.probeBlocked !== undefined
            ? t(props.probeBlocked)
            : askable ? undefined : t('fetchNeedsBaseUrl')}
          onClick={() => { void fetchModels() }}
        >
          {busy ? t('fetching') : t('fetchModels')}
        </button>
        <AutoConfigAllButton
          t={modelExtrasTranslate}
          models={models}
          probe={target}
          operations={operations}
          disabled={disabled}
          onApply={(next) => { onChange([...next]) }}
        />
      </div>
      {models.length === 0 ? <p className={styles.modelEmpty}>{t('modelsEmpty')}</p> : null}
      <div className={styles.modelList}>
        {models.map((model, index) => (
          <ModelRow
            key={index}
            model={model}
            position={index + 1}
            inputField="input"
            inputFallback={inputDefaults.get(textOf(model, 'id')) ?? props.defaultInput}
            inputLoading={catalogProvider !== undefined && catalog === undefined}
            expanded={expanded.has(index)}
            disabled={disabled}
            t={t}
            contextWindow={{
              value: capacityText(model, index, 'contextWindow'),
              placeholder: CAPACITY_HINT.contextWindow,
              onChange: (text) => { editCapacity(index, 'contextWindow', text) },
            }}
            maxTokens={{
              value: capacityText(model, index, 'maxTokens'),
              placeholder: CAPACITY_HINT.maxTokens,
              onChange: (text) => { editCapacity(index, 'maxTokens', text) },
            }}
            onFieldChange={(field, value) => { patch(index, { [field]: value }) }}
            onChange={(next) => { onChange(models.map((row, at) => at === index ? next : row)) }}
            onToggle={() => { toggleExpanded(index) }}
            trailing={(
              <ModelFetchConfigButton
                t={modelExtrasTranslate}
                modelId={typeof model.id === 'string' ? model.id : ''}
                models={models}
                probe={target}
                operations={operations}
                disabled={disabled}
                onApply={(next) => { onChange([...next]) }}
              />
            )}
            advanced={(
              <ModelCompatFields
                t={modelExtrasTranslate}
                model={model}
                index={index}
                disabled={disabled}
                templateCompat={probe.api === TEMPLATE_COMPAT_PROTOCOL}
                onPatch={(next) => { patch(index, next) }}
              />
            )}
            onRemove={() => {
              onChange(models.filter((_model, at) => at !== index))
              setExpanded((current) => {
                const next = new Set<number>()
                for (const at of current) {
                  if (at < index)
                    next.add(at)
                  else if (at > index)
                    next.add(at - 1)
                }
                return next
              })
              setEditing(current => reindexOnRemove(current, index))
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className={styles.addModelButton}
        disabled={disabled}
        onClick={() => { onChange([...models, { id: '' }]) }}
      >
        <Plus width={14} height={14} />
        {t('addModel')}
      </button>
      {failure !== undefined ? <p className={styles.error}>{failure}</p> : null}
      <Modal
        open={candidates !== undefined}
        onClose={closePicker}
        title={t('fetchTitle')}
        closeLabel={t('close')}
        description={t('fetchDescription')}
        className={styles.fetchDialog as string}
        footer={(
          <>
            <Button variant="outline" onClick={closePicker}>{t('cancel')}</Button>
            <Button variant="outline" onClick={adoptPicked}>{t('fetchAdopt')}</Button>
          </>
        )}
      >
        <div className={styles.candidateToolbar}>
          <input
            className={`${styles.input} ${styles.candidateSearch}`}
            type="search"
            value={candidateQuery}
            placeholder={t('fetchSearch')}
            aria-label={t('fetchSearch')}
            onChange={(event) => { setCandidateQuery(event.target.value) }}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={visibleCandidates.length === 0}
            onClick={toggleVisibleCandidates}
          >
            {t(allVisibleCandidatesPicked ? 'fetchDeselectAll' : 'fetchSelectAll')}
          </Button>
        </div>
        {visibleCandidates.length === 0
          ? <p className={styles.candidateEmpty} role="status">{t('fetchNoMatches')}</p>
          : (
              <ul className={styles.candidateList}>
                {visibleCandidates.map(candidate => (
                  <li key={candidate.id} className={styles.candidate}>
                    <label className={styles.candidateLabel}>
                      <input
                        type="checkbox"
                        checked={picked.has(candidate.id)}
                        onChange={() => { toggle(candidate.id) }}
                      />

                      <span className={styles.candidateId}>{candidate.id}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
      </Modal>
    </section>
  )
}
