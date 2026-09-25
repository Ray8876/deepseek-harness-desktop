import type { ChangeEvent, ReactElement } from 'react'
import type { PetSettingsProps } from './pet-settings.types'
import { ArrowRightFromSquare, Button, Icon, Plus, SegmentedControl } from 'dsh-tauri-ui/client'
import { useStore, useWatchImmediate } from 'dsh-tauri/client'
import { useEffect, useId, useRef, useState } from 'react'
import { PET_DEFAULT_SIZE, PET_SIZE_MAX, PET_SIZE_MIN, PET_SIZE_STEP } from '../constants'
import { locale } from '../locales'
import {
  choosePet,
  clearPetSelection,
  enablePet,
  importPetArchive,
  loadForceXwayland,
  loadPetCatalog,
  loadPetOverlaySupported,
  resizePet,
  toggleForceXwayland,
  togglePet,
} from '../service/pet'
import { store } from '../store'
import { PetCard } from './pet-card'

const TAB_OPTIONS = [
  { value: 'pets', label: 'Pets' },
  { value: 'codex', label: 'Codex' },
] as const

/** 读取 .zip 归档为 base64（桌面端命令按字符串收包）。 */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result ?? '')
      const comma = value.indexOf(',')
      resolve(comma >= 0 ? value.slice(comma + 1) : value)
    }
    reader.onerror = () => reject(new Error('PET_FILE_READ_FAILED: failed to read pet archive'))
    reader.readAsDataURL(file)
  })
}

/** 桌宠设置页：预设 / Chat / Codex 三类宠物卡片（选择、启用、取消选择）、开关、大小滑条与导入。 */
export function PetSettings(props: PetSettingsProps): ReactElement {
  locale.useLocale()
  const { status, presetPets, chatPets, codexPets, catalogLoaded, overlaySupported, forceXwayland } = useStore(store.pet)
  const [tab, setTab] = useState<'pets' | 'codex'>('pets')
  const [busy, setBusy] = useState(() => !catalogLoaded)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState(status?.pet_size ?? PET_DEFAULT_SIZE)
  // 切换只落盘，本次进程不会有任何变化，提示重启是用户唯一能看到的反馈。
  const [xwaylandRestart, setXwaylandRestart] = useState(false)
  const tabsId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const committedSizeRef = useRef<number | null>(null)
  const enabled = Boolean(status?.enabled)
  const active = status?.active_pet ?? ''
  const statusSize = status?.pet_size ?? PET_DEFAULT_SIZE

  // 宿主侧尺寸变化同步到本地滑条，正在拖动的本地值不被覆盖。
  useWatchImmediate(statusSize, () => {
    if (statusSize !== committedSizeRef.current)
      setSize(statusSize)
  })

  // 判定在进程生命周期内不变，读到过就不再重复发起；上次失败（仍为 null）时重试。
  useEffect(() => {
    if (overlaySupported === null)
      void loadPetOverlaySupported()
  }, [overlaySupported])

  // 同上的重试语义：读不到只让开关不出现。
  useEffect(() => {
    if (forceXwayland === null)
      void loadForceXwayland()
  }, [forceXwayland])

  useEffect(() => {
    let cancelled = false
    void loadPetCatalog().then((result) => {
      if (cancelled)
        return
      setBusy(false)
      if (!result.ok)
        setError(locale.text('listFailed'))
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function enablePreset(id: string): Promise<void> {
    if (busy || active === id)
      return
    setBusy(true)
    setError(null)
    const result = await enablePet({ id })
    if (!result.ok)
      setError(locale.text('setPetFailed'))
    setBusy(false)
  }

  async function choose(id: string): Promise<void> {
    if (busy || active === id)
      return
    setBusy(true)
    setError(null)
    const result = await choosePet({ id })
    if (!result.ok)
      setError(locale.text('setPetFailed'))
    setBusy(false)
  }

  async function clearSelection(): Promise<void> {
    if (busy || active === '')
      return
    setBusy(true)
    setError(null)
    const result = await clearPetSelection()
    if (!result.ok)
      setError(locale.text('clearFailed'))
    setBusy(false)
  }

  async function toggleEnabled(): Promise<void> {
    if (busy)
      return
    setBusy(true)
    setError(null)
    const result = await togglePet({ enabled: !enabled })
    if (!result.ok)
      setError(locale.text('toggleFailed'))
    setBusy(false)
  }

  /** 切换「强制 XWayland」：应用全局设置，下次启动生效。 */
  async function toggleXwayland(): Promise<void> {
    if (busy)
      return
    setBusy(true)
    setError(null)
    const result = await toggleForceXwayland({ enabled: !forceXwayland })
    if (result.ok)
      setXwaylandRestart(true)
    else
      setError(locale.text('xwaylandFailed'))
    setBusy(false)
  }

  async function commitSize(value: number): Promise<void> {
    setError(null)
    const result = await resizePet({ size: value })
    if (result.ok)
      committedSizeRef.current = value
    else
      setError(locale.text('setSizeFailed'))
  }

  async function createPet(): Promise<void> {
    if (busy)
      return
    setBusy(true)
    setError(null)
    const result = await props.onCreate(props.close)
    if (!result.ok) {
      setError(locale.text('createFailed'))
      setBusy(false)
    }
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy)
      return
    setBusy(true)
    setError(null)
    try {
      const result = await importPetArchive({ name: file.name, data: await readAsBase64(file) })
      if (!result.ok)
        setError(locale.text('importFailed'))
    }
    catch (importError) {
      console.error('[dsh-tauri-pet] import failed:', importError)
      setError(locale.text('importFailed'))
    }
    finally {
      setBusy(false)
    }
  }

  const petsPanel = (
    <>
      {busy && presetPets.length === 0 && chatPets.length === 0
        ? <div className="dshp-pet__loading">{locale.text('loading')}</div>
        : (
            <div className="dshp-pet__cards">
              {presetPets.map(item => (
                <PetCard
                  key={item.id}
                  thumbnail={item.image ?? undefined}
                  name={item.name}
                  desc={item.desc ?? ''}
                  active={active === item.id}
                  disabled={busy}
                  actionLabel={locale.text(active === item.id ? 'clear' : 'enable')}
                  onAction={() => { void (active === item.id ? clearSelection() : enablePreset(item.id)) }}
                />
              ))}
              {chatPets.map(item => (
                <PetCard
                  key={item.id}
                  thumbnail={item.thumbnail}
                  thumbnailType={item.thumbnail ? 'spritesheet' : undefined}
                  name={item.name}
                  desc={item.description ?? ''}
                  active={active === item.id}
                  disabled={busy}
                  actionLabel={locale.text(active === item.id ? 'clear' : 'select')}
                  onAction={() => { void (active === item.id ? clearSelection() : choose(item.id)) }}
                />
              ))}
            </div>
          )}
    </>
  )

  const codexPanel = (
    <div className="dshp-pet__cards">
      {codexPets.length === 0
        ? <div className="dshp-pet__empty">{locale.text('emptyImported')}</div>
        : codexPets.map(item => (
            <PetCard
              key={item.id}
              thumbnail={item.thumbnail}
              thumbnailType={item.thumbnail ? 'spritesheet' : undefined}
              name={item.name}
              desc={item.description ?? ''}
              active={active === item.id}
              disabled={busy}
              actionLabel={locale.text(active === item.id ? 'clear' : 'select')}
              onAction={() => { void (active === item.id ? clearSelection() : choose(item.id)) }}
            />
          ))}
    </div>
  )

  return (
    <div className="dshp-pet__page">
      {/* 开启并重启后 overlaySupported 变回 true、提示消失，没有 forceXwayland 这一支就再也关不掉。
          xwaylandRestart 一支覆盖在 XWayland 下关闭开关的情形：前两个条件同时落空，
          整块会连同刚点过的按钮一起卸载，重启提示无从显示。
          macOS / Windows 上三个条件都不成立，整块不渲染。 */}
      {overlaySupported === false || forceXwayland || xwaylandRestart
        ? (
            <div className="dshp-pet__notice" role="status">
              {overlaySupported === false ? <p>{locale.text('waylandNotice')}</p> : null}
              <div className="dshp-pet__notice-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => { void toggleXwayland() }}
                >
                  {forceXwayland ? locale.text('xwaylandDisable') : locale.text('xwaylandEnable')}
                </Button>
              </div>
              {xwaylandRestart
                ? <p className="dshp-pet__notice-banner">{locale.text('xwaylandRestart')}</p>
                : null}
              <p className="dshp-pet__notice-hint">{locale.text('xwaylandDesc')}</p>
            </div>
          )
        : null}
      <div className="dshp-pet__tabs">
        <SegmentedControl
          id={tabsId}
          label={locale.text('name')}
          value={tab}
          options={TAB_OPTIONS}
          onChange={next => setTab(next === 'codex' ? 'codex' : 'pets')}
        />
        <div className="dshp-pet__tab-tools">
          {tab === 'pets'
            ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Icon as={Plus} />}
                    disabled={busy}
                    onClick={() => { void createPet() }}
                  >
                    {locale.text('create')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => { void toggleEnabled() }}
                  >
                    {enabled ? locale.text('closePet') : locale.text('enablePet')}
                  </Button>
                </>
              )
            : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Icon as={ArrowRightFromSquare} />}
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {locale.text('import')}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".zip"
                    hidden
                    disabled={busy}
                    onChange={(event) => { void onImport(event) }}
                  />
                </>
              )}
        </div>
      </div>
      <p className="dshp-pet__tab-desc">
        {tab === 'pets' ? locale.text('tabInstalledDesc') : locale.text('tabCodexDesc')}
      </p>
      <div id={`${tabsId}-${tab}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
        {tab === 'pets' ? petsPanel : codexPanel}
      </div>
      {error ? <div className="dshp-pet__error" role="alert">{error}</div> : null}
      <div className="dshp-pet__size-row">
        <span className="dshp-pet__size-label">{locale.text('sizeLabel')}</span>
        <input
          type="range"
          className="dshp-pet__size-slider"
          min={PET_SIZE_MIN}
          max={PET_SIZE_MAX}
          step={PET_SIZE_STEP}
          value={size}
          aria-label={locale.text('sizeLabel')}
          onChange={(event) => {
            const value = Number(event.target.value)
            setSize(value)
            void commitSize(value)
          }}
        />
      </div>
      <p className="dshp-pet__hint">{locale.text('sizeHint')}</p>
    </div>
  )
}
