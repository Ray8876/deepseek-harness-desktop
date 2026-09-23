import type { ReactElement } from 'react'
import type { LocaleKey, Translate } from '../locales/index.types'
import type { ScheduleForm, ScheduleKind, SchedulerOptions, TaskFormState, TaskInput, Weekday } from '../types'
import { Button, ChevronDown, Chip, Icon, Input, Menu, Modal } from 'dsh-tauri-ui/client'
import { isEmpty, map, omitBy, pick, range } from 'dsh-tauri/client'
import { useRef, useState } from 'react'
import { SCHEDULE_KINDS } from '../../shared/constants'
import { createTask, updateTask } from '../service/scheduler'
import { ModelPicker } from './model-picker'

export interface TaskCreateDialogProps {
  t: Translate
  options: SchedulerOptions
  /** 关闭回调（保存中忽略）。 */
  onClose: () => void
  /** 编辑模式：传入任务 id 时保存走 updateTask。 */
  taskId?: string
  /** 初始表单（编辑预填 / 推荐预填）；不传则新建空表单。 */
  initial?: TaskFormState
}

const WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const PERMISSION_LABEL_KEYS: Record<string, LocaleKey> = {
  'read-only': 'permissionReadOnly',
  'workspace-write': 'permissionWrite',
  'danger-full-access': 'permissionFullAccess',
}
const WEEKDAY_KEYS: Record<Weekday, LocaleKey> = {
  MO: 'dayMon',
  TU: 'dayTue',
  WE: 'dayWed',
  TH: 'dayThu',
  FR: 'dayFri',
  SA: 'daySat',
  SU: 'daySun',
}
const SCHEDULE_KIND_KEYS: Record<ScheduleKind, LocaleKey> = {
  once: 'scheduleOnce',
  hourly: 'scheduleHourly',
  daily: 'scheduleDaily',
  interval: 'scheduleInterval',
  workdays: 'scheduleWorkdays',
  weekly: 'scheduleWeekly',
  monthly: 'scheduleMonthly',
  custom: 'scheduleCustom',
}

interface SelectOption {
  value: string
  label: string
}

/** 时间段选项：00:00 ~ 23:45，每 15 分钟一档。 */
const TIME_OPTIONS: SelectOption[] = range(96).map((index) => {
  const total = index * 15
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  const time = `${h}:${m}`
  return { value: time, label: time }
})

/** 整点分钟选项。 */
const MINUTE_OPTIONS: SelectOption[] = Array.from({ length: 60 }, (_, minute) => ({
  value: String(minute),
  label: `: ${String(minute).padStart(2, '0')}`,
}))

/** 表单里「空串即缺省」的可选字段（写入宿主前剔除）。 */
const OPTIONAL_INPUT_FIELDS = ['workspaceId', 'permission', 'provider', 'model', 'reasoningEffort'] as const

/** 间隔时长选项（分钟）。 */
const INTERVAL_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440]

/** 各计划模式的默认参数（切换模式时初始化，保证字段齐整）。 */
function defaultScheduleFor(kind: ScheduleForm['kind']): ScheduleForm {
  switch (kind) {
    case 'once':
      return { kind: 'once', at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
    case 'hourly':
      return { kind: 'hourly', minute: 0 }
    case 'interval':
      return { kind: 'interval', everyMinutes: 30 }
    case 'monthly':
      return { kind: 'monthly', day: 1, time: '09:00' }
    case 'custom':
      return { kind: 'custom', everyDays: 2, time: '09:00' }
    case 'weekly':
      return { kind: 'weekly', weekdays: ['MO'], time: '09:00' }
    case 'workdays':
      return { kind: 'workdays', time: '09:00' }
    default:
      return { kind: 'daily', time: '09:00' }
  }
}

/** dsh-tauri-ui 没有独立 Select：统一用 Chip(selector) + Menu 组合。 */
function Select({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      onSelect={(id) => {
        setOpen(false)
        onChange(id)
      }}
      items={options.map(option => ({ id: option.value, label: option.label }))}
      selectedId={value}
      portal
      align="end"
      anchor={(
        <Chip
          variant="selector"
          open={open}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(openState => !openState)}
          chevron={<Icon as={ChevronDown} />}
        >
          <span>{options.find(option => option.value === value)?.label ?? value}</span>
        </Chip>
      )}
    />
  )
}

export function TaskCreateDialog({ t, options, onClose, taskId, initial }: TaskCreateDialogProps): ReactElement {
  const [form, setForm] = useState<TaskFormState>(() => initial ?? {
    name: '',
    schedule: { kind: 'daily', time: '09:00' },
    prompt: '',
    workspaceId: '',
    permission: options.defaultPermission || 'read-only',
    provider: options.defaultModel?.provider ?? '',
    model: options.defaultModel?.model ?? '',
    reasoningEffort: options.defaultModel?.reasoning?.defaultEffort ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 保存中禁止关闭（Esc / 遮罩 / 关闭按钮）：用 ref 供稳定闭包读取最新值。
  const savingRef = useRef(false)
  savingRef.current = saving

  function closeSafe(): void {
    if (savingRef.current)
      return
    onClose()
  }

  function setSchedule(patch: Partial<ScheduleForm>): void {
    setForm(state => ({ ...state, schedule: { ...state.schedule, ...patch } as ScheduleForm }))
  }

  async function onSave(): Promise<void> {
    setSaving(true)
    setError('')
    const input: TaskInput = {
      name: form.name,
      schedule: form.schedule,
      prompt: form.prompt,
      ...omitBy(pick(form, ...OPTIONAL_INPUT_FIELDS), isEmpty),
    }
    const result = await (taskId ? updateTask(taskId, input) : createTask(input))
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? t('createFailed'))
      return
    }
    onClose()
  }

  const scheduleKind = form.schedule.kind
  const currentTime = ('time' in form.schedule) ? form.schedule.time : '09:00'
  const currentEveryMinutes = form.schedule.kind === 'interval' ? form.schedule.everyMinutes : 30
  const currentWeekday: Weekday = form.schedule.kind === 'weekly' ? (form.schedule.weekdays[0] ?? 'MO') : 'MO'

  const workspaceOptions: SelectOption[] = [
    // 空 id 由宿主解释为默认/未分组工作区，必须保留。
    { value: '', label: t('workspaceDefault') },
    ...options.workspaces.map(ws => ({ value: ws.id, label: ws.title || ws.path })),
  ]
  // 权限选项：来自宿主 permissionPresets；缺失降级为常见三项（含完全访问）。
  const fallbackPermissions: SelectOption[] = [
    { value: 'read-only', label: t('permissionReadOnly') },
    { value: 'workspace-write', label: t('permissionWrite') },
    { value: 'danger-full-access', label: t('permissionFullAccess') },
  ]
  const permissionOptions: SelectOption[] = isEmpty(options.permissions)
    ? fallbackPermissions
    : map(options.permissions, option => ({
        value: option.value,
        label: PERMISSION_LABEL_KEYS[option.value] ? t(PERMISSION_LABEL_KEYS[option.value]) : option.name,
      }))
  // 编辑旧任务：当前值不在选项里时补一项，避免显示空值。
  if (form.permission && !permissionOptions.some(option => option.value === form.permission))
    permissionOptions.unshift({ value: form.permission, label: form.permission })

  const modelKey = form.provider && form.model ? `${form.provider}::${form.model}` : 'default'

  return (
    <Modal
      open
      onClose={closeSafe}
      title={taskId ? t('editDialogTitle') : t('createDialogTitle')}
      description={t('dialogHint')}
      closeLabel={t('close')}
      className="dshp-scheduler__modal"
      footer={(
        <>
          <Button variant="outline" disabled={saving} onClick={closeSafe}>{t('cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={() => void onSave()}>
            {t('save')}
          </Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="dshp-scheduler__field">
          <span className="dshp-scheduler__field-label">{t('taskName')}</span>
          <Input
            type="text"
            value={form.name}
            placeholder={t('taskNamePlaceholder')}
            onChange={event => setForm(state => ({ ...state, name: event.target.value }))}
          />
        </label>

        <div className="dshp-scheduler__field">
          <span className="dshp-scheduler__field-label">{t('schedule')}</span>
          <div className="dshp-scheduler__inline">
            <Select
              label={t('schedule')}
              value={scheduleKind}
              options={SCHEDULE_KINDS.map(kind => ({ value: kind, label: t(SCHEDULE_KIND_KEYS[kind]) }))}
              onChange={value => setForm(state => ({ ...state, schedule: defaultScheduleFor(value as ScheduleForm['kind']) }))}
            />

            {scheduleKind === 'once'
              ? (
                  <Input
                    className="dshp-scheduler__schedule-once"
                    type="datetime-local"
                    value={String(form.schedule.at).slice(0, 16)}
                    onChange={event => setSchedule({ kind: 'once', at: new Date(event.target.value).toISOString() })}
                  />
                )
              : scheduleKind === 'hourly'
                ? (
                    <Select
                      label={t('scheduleHourly')}
                      value={String(form.schedule.minute)}
                      options={MINUTE_OPTIONS}
                      onChange={value => setSchedule({ kind: 'hourly', minute: Number(value) })}
                    />
                  )
                : scheduleKind === 'monthly'
                  ? (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={form.schedule.kind === 'monthly' ? form.schedule.day : 1}
                          aria-label={t('scheduleMonthDay')}
                          onChange={event => setSchedule({ kind: 'monthly', day: Number(event.target.value), time: currentTime })}
                        />
                        <Select
                          label={t('scheduleTime')}
                          value={currentTime}
                          options={TIME_OPTIONS}
                          onChange={value => setSchedule({ kind: 'monthly', day: form.schedule.kind === 'monthly' ? form.schedule.day : 1, time: value })}
                        />
                      </>
                    )
                  : scheduleKind === 'custom'
                    ? (
                        <>
                          <Input
                            type="number"
                            min={1}
                            max={366}
                            value={form.schedule.kind === 'custom' ? form.schedule.everyDays : 1}
                            aria-label={t('scheduleEveryDays')}
                            onChange={event => setSchedule({ kind: 'custom', everyDays: Number(event.target.value), time: currentTime })}
                          />
                          <span>{t('dayShort')}</span>
                          <Select
                            label={t('scheduleTime')}
                            value={currentTime}
                            options={TIME_OPTIONS}
                            onChange={value => setSchedule({ kind: 'custom', everyDays: form.schedule.kind === 'custom' ? form.schedule.everyDays : 1, time: value })}
                          />
                        </>
                      )
                    : scheduleKind === 'interval'
                      ? (
                          <Select
                            label={t('scheduleEveryMinutes')}
                            value={String(currentEveryMinutes)}
                            options={INTERVAL_OPTIONS.map(minutes => ({ value: String(minutes), label: `${minutes} ${t('minuteShort')}` }))}
                            onChange={value => setSchedule({ kind: 'interval', everyMinutes: Number(value), anchor: form.schedule.kind === 'interval' ? form.schedule.anchor : undefined })}
                          />
                        )
                      : scheduleKind === 'weekly'
                        ? (
                            <>
                              <Select
                                label={t('scheduleWeekdays')}
                                value={currentWeekday}
                                options={WEEKDAYS.map(day => ({ value: day, label: t(WEEKDAY_KEYS[day]) }))}
                                onChange={value => setSchedule({ kind: 'weekly', weekdays: [value as Weekday], time: currentTime })}
                              />
                              <Select
                                label={t('scheduleTime')}
                                value={currentTime}
                                options={TIME_OPTIONS}
                                onChange={value => setSchedule({ ...form.schedule, time: value } as ScheduleForm)}
                              />
                            </>
                          )
                        : (
                            <Select
                              label={t('scheduleTime')}
                              value={currentTime}
                              options={TIME_OPTIONS}
                              onChange={value => setSchedule({ ...form.schedule, time: value } as ScheduleForm)}
                            />
                          )}
          </div>
        </div>

        <div className="dshp-scheduler__field">
          <span className="dshp-scheduler__field-label">{t('schedulePrompt')}</span>
          <div className="dshp-scheduler__prompt-wrap">
            <textarea
              className="dshp-scheduler__textarea"
              value={form.prompt}
              placeholder={t('schedulePromptPlaceholder')}
              onChange={event => setForm(state => ({ ...state, prompt: event.target.value }))}
            />
            <div className="dshp-scheduler__composer">
              <Select
                label={t('workspace')}
                value={form.workspaceId}
                options={workspaceOptions}
                onChange={id => setForm(state => ({ ...state, workspaceId: id }))}
              />
              <Select
                label={t('permission')}
                value={form.permission}
                options={permissionOptions}
                onChange={id => setForm(state => ({ ...state, permission: id }))}
              />
              <div style={{ flex: 1 }} />
              <ModelPicker
                t={t}
                models={options.models ?? []}
                failures={options.failures ?? []}
                modelKey={modelKey}
                reasoningEffort={form.reasoningEffort === '' ? 'none' : form.reasoningEffort}
                onSelection={(nextKey, effort) => {
                // 照搬 dsh-automation：modelKey = `${provider}::${model}`；'default' 仅在
                // 目录无默认模型时出现（trigger 显示官方 fallback「选择模型」）。
                  const sep = nextKey.indexOf('::')
                  const provider = sep >= 0 ? nextKey.slice(0, sep) : ''
                  const model = sep >= 0 ? nextKey.slice(sep + 2) : ''
                  setForm(state => ({
                    ...state,
                    provider,
                    model,
                    // 'none' = 提供商默认 → 落库空串。
                    reasoningEffort: effort === 'none' ? '' : effort,
                  }))
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {error ? <p className="dshp-scheduler__error" role="alert">{error}</p> : null}
    </Modal>
  )
}
