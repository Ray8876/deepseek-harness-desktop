import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { SettingsTriggerProps } from './trigger.types'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { SlotOutlet } from '@deepseek-ai/dsh-client-ui-renderer'
import { uniq, useStore } from 'dsh-tauri/client'
import { useCallback, useEffect, useState } from 'react'
import { Gear } from '../components/icons'
import {
  SETTINGS_LAUNCHER_SLOT,
  SETTINGS_ONBOARDING_SLOT,
  SETTINGS_TRIGGER_SLOT,
} from '../constants'
import { useMountStyle } from '../hooks/use-mount-style'
import { locale } from '../locales'
import { store } from '../store'
import settingsTriggerStyle from './trigger.cssr'

const SETTINGS_TRIGGER_STYLE_ID = 'dsh-tauri-ui-settings-trigger-styles'

interface RetainedSessionLike {
  retainedBy?: Readonly<Record<string, number | undefined>>
}

// 0.1.7 起列表快照不再带 current，「当前会话」改由主视图持有的 reference 表达。
function isMainViewRetained(session: RetainedSessionLike): boolean {
  return (session.retainedBy?.mainView ?? 0) > 0
}

export function SettingsTrigger({ wide, useSessions }: SettingsTriggerProps): ReactElement {
  const { open, launcherAvailable } = useStore(store.settings)
  const { onboarding } = useStore(store.sections)
  useMountStyle(settingsTriggerStyle, SETTINGS_TRIGGER_STYLE_ID)
  const [completed, setCompleted] = useState<string[]>([])

  const onboardingActive = useSessions((state) => {
    if (state.phase !== 'ready')
      return false
    if (state.current !== undefined)
      return state.byId[state.current]?.blank === true
    const main = Object.values(state.byId).find(session => isMainViewRetained(session))
    return main === undefined || main.blank === true
  })

  useEffect(() => {
    if (!onboardingActive)
      setCompleted([])
  }, [onboardingActive])

  const step = onboardingActive ? onboarding.find(s => !completed.includes(s.id)) : undefined

  const completeStep = useCallback((id: string) => {
    setCompleted(previous => uniq([...previous, id]))
  }, [])

  const openSection = useCallback((id: string) => {
    store.settings.openAt(id)
  }, [])

  const [menuOpen, setMenuOpen] = useState(false)
  locale.useLocale()
  // 官方账号菜单占据设置座位时它就是「设置菜单」；座位缺席（更老核心 / 浏览器直开）时
  // 由壳层自己给菜单——两者条目结构一致，宠物等插件按「含『设置』条目」补条目。
  const menuItems: MenuEntry[] = [
    { id: 'settings', label: locale.text('settings'), icon: <Gear width={16} height={16} /> },
  ]

  const trigger = (
    <button
      type="button"
      aria-haspopup={launcherAvailable ? 'dialog' : 'menu'}
      // 触发器同时是「设置菜单」和「设置侧栏」的入口：菜单开着或侧栏开着都算展开，
      // 这样桌面载体（官方账号菜单直接开侧栏）与浏览器态（先开菜单再选设置）语义一致。
      aria-expanded={open || menuOpen}
      onClick={() => {
        if (launcherAvailable) {
          store.settings.openAt()
          return
        }
        setMenuOpen(value => !value)
      }}
      className={`dshp-settings-trigger${wide ? '' : ' dshp-settings-trigger--rail'}`}
    >
      <SlotOutlet slotKey={SETTINGS_TRIGGER_SLOT} ownerProps={{ wide }} />
    </button>
  )

  return (
    <>
      {launcherAvailable
        ? (
            <SlotOutlet
              slotKey={SETTINGS_LAUNCHER_SLOT}
              ownerProps={{
                wide,
                openSettings: () => store.settings.openAt(),
                openOnboarding: (id: string) => store.settings.openAt(id),
              }}
              opts={{ fallback: trigger }}
            />
          )
        : (
            <Menu
              open={menuOpen}
              side="top"
              align="start"
              portal
              autoFocus
              className="dshp-settings-trigger-host"
              items={menuItems}
              anchor={trigger}
              onSelect={(id: string) => {
                setMenuOpen(false)
                if (id === 'settings')
                  store.settings.openAt()
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
      {step !== undefined && (
        <SlotOutlet
          slotKey={SETTINGS_ONBOARDING_SLOT}
          ownerProps={{
            stepId: step.id,
            complete: () => completeStep(step.id),
            openSection,
          }}
          opts={{ only: step.id }}
        />
      )}
    </>
  )
}
