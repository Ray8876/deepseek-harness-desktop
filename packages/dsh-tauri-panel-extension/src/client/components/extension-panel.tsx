import type { ReactElement } from 'react'
import type { MarketFace } from '../service/market.types'
import { SegmentedControl } from 'dsh-tauri-ui/client'
import { useEffect, useId, useState } from 'react'
import { locale } from '../locales'
import { resolveActiveTab } from './extension-panel.utils'
import { MarketTab } from './market-tab'
import { McpTab } from './mcp-tab'
import { SkillsTab } from './skills-tab'

export interface ExtensionPanelProps {
  createSkill: () => Promise<void>
  /** 市场未安装 / 未发布 `render` 时为 undefined：此时不出现市场标签页。 */
  market: MarketFace | undefined
}

interface ExtensionTab {
  id: string
  label: string
  render: () => ReactElement
}

export function ExtensionPanel({ createSkill, market }: ExtensionPanelProps): ReactElement {
  const t = locale.text
  const tabsId = useId()
  const marketFace = market
  const rows: ExtensionTab[] = [
    ...(marketFace === undefined
      ? []
      : [{ id: 'market', label: t('marketTab'), render: () => <MarketTab market={marketFace} /> }]),
    { id: 'skills', label: t('skillsTab'), render: () => <SkillsTab t={t} createSkill={createSkill} /> },
    { id: 'mcp', label: t('mcpTab'), render: () => <McpTab t={t} /> },
  ]
  const initialId = rows[0]?.id ?? 'skills'
  const [requestedId, setRequestedId] = useState(initialId)
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([initialId]))
  const activeId = resolveActiveTab(rows, requestedId)
  // 市场服务消失时会回落到别的标签页：那也已经「打开过」，同样要留在挂载集里，
  // 否则市场一回来它就卸载，用户在那一页里的状态被丢掉。
  useEffect(() => setVisited(previous => previous.has(activeId) ? previous : new Set([...previous, activeId])), [activeId])

  return (
    <div className="dshp-extension">
      <div className="dshp-extension__section">
        <div>
          <SegmentedControl
            id={tabsId}
            label={t('extension')}
            value={activeId}
            options={rows.map(row => ({ value: row.id, label: row.label }))}
            onChange={setRequestedId}
          />
        </div>
        {rows.filter(row => row.id === activeId || visited.has(row.id)).map((row) => {
          const selected = row.id === activeId
          return <div key={row.id} id={`${tabsId}-${row.id}-panel`} className="dshp-extension__tab-panel" role="tabpanel" aria-labelledby={`${tabsId}-${row.id}`} hidden={!selected}>{row.render()}</div>
        })}
      </div>
    </div>
  )
}
