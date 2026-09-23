import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './chip'
import chipStyle from './chip.cssr'

vi.mock('dsh-tauri/client', () => ({ compact: (values: unknown[]) => values.filter(Boolean) }))

const VARIANTS = ['seat', 'composerTrigger', 'selector'] as const
const CHEVRON_SVG = '.dshp-chip .dshp-chip__chevron svg'
const TRIGGER_ICON_SVG = '.dshp-chip.dshp-chip--composerTrigger .dshp-chip__icon svg'

const css = chipStyle.render()

function draw(variant: (typeof VARIANTS)[number]): string {
  return renderToStaticMarkup(createElement(Chip, {
    variant,
    icon: createElement('svg', { 'data-icon': true }),
    badge: createElement('span', { 'data-badge': true }),
    chevron: createElement('svg', { 'data-chevron': true }),
    open: true,
  }, 'label'))
}

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `no emitted rule for ${selector}`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

const markup = VARIANTS.map(draw).join('')
const elementClasses = [...markup.matchAll(/class="([^"]*)"/g)].map(match => match[1].split(' '))
const renderedClasses = new Set(elementClasses.flat())
const emittedClasses = [...new Set(css.match(/\.dshp-[\w-]+/g) ?? [])].map(token => token.slice(1))

describe('chip cssr contract', () => {
  it('emits only classes the rendered chip carries', () => {
    expect(emittedClasses.filter(token => !renderedClasses.has(token))).toEqual([])
  })

  it('matches every modifier selector against a rendered element', () => {
    for (const variant of VARIANTS) {
      const required = ['dshp-chip', `dshp-chip--${variant}`]
      expect(css).toContain(`.${required.join('.')}`)
      expect(elementClasses.some(tokens => required.every(token => tokens.includes(token))), variant).toBe(true)
    }
  })

  it('wraps the composer trigger like PermissionSelect', () => {
    const trigger = draw('composerTrigger')
    expect(trigger).toContain('class="dshp-chip dshp-chip--composerTrigger"')
    expect(trigger).toContain('<span class="dshp-chip__icon" aria-hidden="true">')
    expect(trigger).toContain('<span class="dshp-chip__label">label</span>')
    expect(trigger).toContain('<span class="dshp-chip__badge" aria-hidden="true">')
    expect(trigger.indexOf('dshp-chip__label')).toBeLessThan(trigger.indexOf('dshp-chip__badge'))
    expect(trigger.indexOf('dshp-chip__badge')).toBeLessThan(trigger.indexOf('dshp-chip__chevron'))
  })

  it('keeps PermissionRow.selector unwrapped', () => {
    expect(draw('selector')).toContain('class="dshp-chip dshp-chip--selector"><svg data-icon')
    expect(draw('selector')).not.toContain('dshp-chip__label')
  })

  it('collapses the label on the composer row container', () => {
    expect(css).toContain('@container (max-width: 460px) {')
    expect(css).toContain('.dshp-chip--composerTrigger:has(.dshp-chip__icon) .dshp-chip__label {')
    expect(draw('composerTrigger')).toContain('class="dshp-chip__label"')
  })

  it('pins the chevron glyph once, for every variant', () => {
    const chevron = ruleBody(CHEVRON_SVG)
    expect(chevron).toContain('width: 11px')
    expect(chevron).toContain('height: 11px')
    for (const variant of VARIANTS) {
      expect(css).not.toContain(`.dshp-chip--${variant} .dshp-chip__chevron svg`)
      expect(draw(variant)).toContain('class="dshp-chip__chevron"')
    }
  })

  it('pins the trigger icon to the official 14px and leaves the seat icon to its caller', () => {
    const icon = ruleBody(TRIGGER_ICON_SVG)
    expect(icon).toContain('width: 14px')
    expect(icon).toContain('height: 14px')
    expect(css).not.toContain('.dshp-chip--seat .dshp-chip__icon svg')
  })

  it('hides the decorative wrappers from assistive tech', () => {
    for (const span of ['dshp-chip__icon', 'dshp-chip__badge', 'dshp-chip__chevron'])
      expect(draw('composerTrigger')).toContain(`class="${span}" aria-hidden="true"`)
  })
})
