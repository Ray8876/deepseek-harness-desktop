import type { ReactElement } from 'react'
import type { SegmentedControlProps } from './segmented-control.types'
import { useRef } from 'react'
import { useMountStyle } from '../hooks/use-mount-style'
import segmentedControlStyle from './segmented-control.cssr'

export const SEGMENTED_CONTROL_STYLE_ID = 'dsh-tauri-ui-segmented-control-styles'

const FORWARD_KEYS = ['ArrowRight', 'ArrowDown']
const BACKWARD_KEYS = ['ArrowLeft', 'ArrowUp']

export function stepSegment<T extends { disabled?: boolean }>(
  options: readonly T[],
  current: number,
  key: string,
): number | undefined {
  const count = options.length
  if (count === 0)
    return undefined
  if (key === 'Home' || key === 'End') {
    const index = key === 'Home' ? 0 : count - 1
    return options[index]?.disabled === true ? undefined : index
  }
  const forward = FORWARD_KEYS.includes(key)
  if (!forward && !BACKWARD_KEYS.includes(key))
    return undefined
  const step = forward ? 1 : -1
  for (let offset = 1; offset <= count; offset++) {
    const index = ((current + step * offset) % count + count) % count
    if (options[index]?.disabled !== true)
      return index
  }
  return undefined
}

export function SegmentedControl({ id, label, value, disabled, options, onChange }: SegmentedControlProps): ReactElement {
  useMountStyle(segmentedControlStyle, SEGMENTED_CONTROL_STYLE_ID)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const tabbed = id !== undefined
  const selected = options.findIndex(option => option.value === value)

  const move = (key: string): void => {
    if (disabled === true)
      return
    const index = stepSegment(options, selected < 0 ? 0 : selected, key)
    if (index === undefined)
      return
    const option = options[index]
    if (option === undefined)
      return
    refs.current[index]?.focus()
    if (option.value !== value)
      onChange(option.value)
  }

  const segmentId = (index: number): string | undefined => {
    if (id === undefined)
      return undefined
    return `${id}-${options[index]?.value ?? index}`
  }

  return (
    <div
      className="dshp-segmented-control"
      role={tabbed ? 'tablist' : 'group'}
      aria-label={label}
      onKeyDown={(event) => {
        move(event.key)
      }}
    >
      {options.map((option, index) => {
        const active = option.value === value
        const locked = disabled === true || option.disabled === true
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node }}
            type="button"
            id={segmentId(index)}
            role={tabbed ? 'tab' : undefined}
            className={`dshp-segmented-control__option${active ? ' dshp-segmented-control__option--selected' : ''}`}
            aria-selected={tabbed ? active : undefined}
            aria-controls={tabbed && id !== undefined ? `${id}-${option.value}-panel` : undefined}
            aria-pressed={tabbed ? undefined : active}
            tabIndex={tabbed ? (active || (selected < 0 && index === 0) ? 0 : -1) : undefined}
            title={option.title}
            disabled={locked}
            onClick={() => {
              if (!locked && !active)
                onChange(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
