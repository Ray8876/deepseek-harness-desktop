import type { SegmentedControlOption } from './segmented-control.types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from '../components/checkbox'
import { SegmentedControl, stepSegment } from './segmented-control'

const OPTIONS: SegmentedControlOption[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
]

describe('stepSegment', () => {
  it('walks forward and backward, wrapping at both ends', () => {
    expect(stepSegment(OPTIONS, 0, 'ArrowRight')).toBe(1)
    expect(stepSegment(OPTIONS, 2, 'ArrowRight')).toBe(0)
    expect(stepSegment(OPTIONS, 0, 'ArrowLeft')).toBe(2)
    expect(stepSegment(OPTIONS, 1, 'ArrowUp')).toBe(0)
    expect(stepSegment(OPTIONS, 1, 'ArrowDown')).toBe(2)
  })

  it('jumps to the ends with Home and End', () => {
    expect(stepSegment(OPTIONS, 2, 'Home')).toBe(0)
    expect(stepSegment(OPTIONS, 0, 'End')).toBe(2)
  })

  it('skips disabled segments instead of stalling on them', () => {
    const options: SegmentedControlOption[] = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }]
    expect(stepSegment(options, 0, 'ArrowRight')).toBe(2)
    expect(stepSegment(options, 2, 'ArrowLeft')).toBe(0)
  })

  it('ignores keys it does not own and a fully locked control', () => {
    expect(stepSegment(OPTIONS, 0, 'Enter')).toBeUndefined()
    expect(stepSegment(OPTIONS, 0, 'Tab')).toBeUndefined()
    expect(stepSegment([{ value: 'a', label: 'A', disabled: true }], 0, 'ArrowRight')).toBeUndefined()
    expect(stepSegment([], 0, 'ArrowRight')).toBeUndefined()
  })
})

describe('segmentedControl markup', () => {
  it('renders a labelled tablist whose segments point at their panels', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl id="mode" label="Mode" value="b" options={OPTIONS} onChange={vi.fn()} />,
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Mode"')
    expect(html).toContain('id="mode-a"')
    expect(html).toContain('id="mode-b"')
    expect(html).toContain('aria-controls="mode-a-panel"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('aria-selected="false"')
  })

  it('keeps only the selected segment in the tab order', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl id="mode" value="b" options={OPTIONS} onChange={vi.fn()} />,
    )
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
  })

  it('falls back to a group without a tab contract when no id is given', () => {
    const html = renderToStaticMarkup(<SegmentedControl value="a" options={OPTIONS} onChange={vi.fn()} />)
    expect(html).toContain('role="group"')
    expect(html).not.toContain('role="tab"')
    expect(html).not.toContain('aria-selected')
    expect(html).toContain('aria-pressed="true"')
  })

  it('locks every segment while disabled and honours per-option locks', () => {
    const locked = renderToStaticMarkup(
      <SegmentedControl id="mode" value="a" disabled options={OPTIONS} onChange={vi.fn()} />,
    )
    expect(locked.match(/disabled=""/g)).toHaveLength(3)
    const partial = renderToStaticMarkup(
      <SegmentedControl
        id="mode"
        value="a"
        options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true, title: 'no' }]}
        onChange={vi.fn()}
      />,
    )
    expect(partial.match(/disabled=""/g)).toHaveLength(1)
    expect(partial).toContain('title="no"')
  })
})

describe('checkbox markup', () => {
  it('renders a real checkbox carrying the checked state', () => {
    const html = renderToStaticMarkup(<Checkbox checked onChange={vi.fn()} />)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked=""')
    const off = renderToStaticMarkup(<Checkbox checked={false} onChange={vi.fn()} />)
    expect(off).not.toContain('checked')
  })

  it('renders children as a visible label next to the input', () => {
    const html = renderToStaticMarkup(<Checkbox checked={false} onChange={vi.fn()}>Enable thinking</Checkbox>)
    expect(html).toContain('dshp-checkbox__label')
    expect(html).toContain('Enable thinking')
  })

  it('passes the accessible name and the disabled state through', () => {
    const html = renderToStaticMarkup(<Checkbox checked={false} disabled aria-label="Image input" onChange={vi.fn()} />)
    expect(html).toContain('aria-label="Image input"')
    expect(html).toContain('disabled=""')
  })
})
