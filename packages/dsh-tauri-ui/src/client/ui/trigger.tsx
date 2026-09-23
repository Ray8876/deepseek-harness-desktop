import type { ReactElement } from 'react'
import type { SettingsTriggerProps } from './trigger.types'
import { SlotOutlet } from '@deepseek-ai/dsh-client-ui-renderer'
import { uniq, useStore } from 'dsh-tauri/client'
import { useCallback, useEffect, useState } from 'react'
import {
  SETTINGS_ONBOARDING_SLOT,
  SETTINGS_TRIGGER_SLOT,
} from '../constants'
import { useMountStyle } from '../hooks/use-mount-style'
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
  const { open } = useStore(store.settings)
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

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => store.settings.openAt()}
        className={`dshp-settings-trigger${wide ? '' : ' dshp-settings-trigger--rail'}`}
      >
        <SlotOutlet slotKey={SETTINGS_TRIGGER_SLOT} ownerProps={{ wide }} />
      </button>
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
