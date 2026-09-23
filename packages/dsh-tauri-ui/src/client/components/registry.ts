export interface UiComponentSource {
  kind: 'reexport' | 'refork'
  component: string
  variant?: string
  package: string
  version: string
  availableAt: readonly string[]
  upstreamPath: string
  mappedClass?: string
}

export interface UiComponentEntry {
  id: string
  title: string
  source: UiComponentSource
}

const PRIMITIVES = '@deepseek-ai/dsh-client-ui-primitives'
const VERSION = '0.1.7-alpha.1'
const AVAILABLE_BOTH = ['0.1.5-rc.1', '0.1.7-alpha.1']
const AVAILABLE_LATEST = ['0.1.7-alpha.1']

function slug(name: string): string {
  return name.replaceAll('_', '-').replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function primitives(component: string, file: string): UiComponentEntry {
  return {
    id: slug(component),
    title: component,
    source: {
      kind: 'reexport',
      component,
      package: PRIMITIVES,
      version: VERSION,
      availableAt: AVAILABLE_BOTH,
      upstreamPath: `packages/client/ui-primitives/src/${file}.tsx`,
    },
  }
}

function reforkVariant(
  component: string,
  variant: string,
  source: Omit<UiComponentSource, 'kind' | 'component' | 'variant' | 'version'>,
): UiComponentEntry {
  return {
    id: `${slug(component)}-${slug(variant)}`,
    title: `${component} · ${variant}`,
    source: {
      kind: 'refork',
      component,
      variant,
      version: VERSION,
      ...source,
    },
  }
}

export const UI_COMPONENT_REGISTRY: readonly UiComponentEntry[] = [
  primitives('Button', 'Button'),
  primitives('ButtonVariant', 'Button'),
  primitives('Switch', 'Switch'),
  primitives('Tag', 'Tag'),
  primitives('TagTone', 'Tag'),
  primitives('Pill', 'Pill'),
  primitives('Menu', 'Menu'),
  primitives('MenuEntry', 'Menu'),
  primitives('MenuItem', 'Menu'),
  primitives('MenuLabel', 'Menu'),
  primitives('MenuSeparator', 'Menu'),
  primitives('Input', 'Input'),
  primitives('Tooltip', 'Tooltip'),
  primitives('TooltipSide', 'Tooltip'),
  primitives('Toast', 'Toast'),
  primitives('Modal', 'Modal'),
  primitives('HoverCard', 'HoverCard'),
  primitives('DisclosureRow', 'DisclosureRow'),
  primitives('DisclosureRowProps', 'DisclosureRow'),
  primitives('StateDot', 'StateDot'),
  primitives('StateDotState', 'StateDot'),
  primitives('ConnectionIndicator', 'ConnectionIndicator'),
  primitives('ConnectionIndicatorState', 'ConnectionIndicator'),
  primitives('BrandWordmark', 'BrandWordmark'),
  primitives('BrandWordmarkProps', 'BrandWordmark'),
  primitives('FishLogo', 'FishLogo'),
  primitives('FISH_LOGO_PATH', 'FishLogo'),
  primitives('FISH_LOGO_VIEWBOX', 'FishLogo'),

  reforkVariant('Checkbox', 'default', {
    package: PRIMITIVES,
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-primitives/src/Checkbox.tsx',
    mappedClass: 'checkbox',
  }),
  reforkVariant('StateDot', 'dot', {
    package: PRIMITIVES,
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-primitives/src/StateDot.module.css',
    mappedClass: 'dot',
  }),
  reforkVariant('Button', 'elevated', {
    package: '@deepseek-ai/dsh-client-ui-sidebar',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css',
    mappedClass: 'newSession',
  }),
  reforkVariant('Button', 'add', {
    package: '@deepseek-ai/dsh-client-ui-plugin-manager',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css',
    mappedClass: 'addButton',
  }),
  reforkVariant('Button', 'addGhost', {
    package: '@deepseek-ai/dsh-client-ui-plugin-manager',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css',
    mappedClass: 'addButton',
  }),
  reforkVariant('Button', 'danger', {
    package: '@deepseek-ai/dsh-client-ui-plugin-manager',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css',
    mappedClass: 'danger',
  }),
  reforkVariant('IconButton', 'search', {
    package: '@deepseek-ai/dsh-client-ui-workspace',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.module.css',
    mappedClass: 'searchButton',
  }),
  reforkVariant('IconButton', 'toolbar', {
    package: '@deepseek-ai/dsh-client-ui-plugin-manager',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css',
    mappedClass: 'iconButton',
  }),
  reforkVariant('IconButton', 'model', {
    package: '@deepseek-ai/dsh-client-ui-settings-models',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-settings-models/src/client/ModelsSection.module.css',
    mappedClass: 'iconButton',
  }),
  reforkVariant('IconButton', 'round', {
    package: '@deepseek-ai/dsh-client-ui-sidebar',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-sidebar/src/client/SidebarRoot.module.css',
    mappedClass: 'iconButton',
  }),
  reforkVariant('IconButton', 'row', {
    package: '@deepseek-ai/dsh-client-ui-workspace',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-workspace/src/client/rows/Rows.module.css',
    mappedClass: 'iconButton',
  }),
  reforkVariant('IconButton', 'help', {
    package: PRIMITIVES,
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-primitives/src/settings-form/fields.module.css',
    mappedClass: 'helpButton',
  }),
  reforkVariant('IconButton', 'action', {
    package: '@deepseek-ai/dsh-client-ui-chat',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-chat/src/client/chat/MessageIconActions.module.css',
    mappedClass: 'action',
  }),
  reforkVariant('Chip', 'seat', {
    package: '@deepseek-ai/dsh-client-ui-agent-preset',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-agent-preset/src/client/AgentPresetSeat.module.css',
    mappedClass: 'seat',
  }),
  reforkVariant('Chip', 'composerTrigger', {
    package: '@deepseek-ai/dsh-client-ui-permission-presets',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-permission-presets/src/client/PermissionSelect.module.css',
    mappedClass: 'trigger',
  }),
  reforkVariant('Chip', 'selector', {
    package: '@deepseek-ai/dsh-client-ui-permission-presets',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-permission-presets/src/client/PermissionRow.module.css',
    mappedClass: 'selector',
  }),
  reforkVariant('GoalBar', 'bar', {
    package: '@deepseek-ai/dsh-client-ui-goal',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-goal/src/client/GoalBar.module.css',
    mappedClass: 'bar',
  }),
  reforkVariant('GoalBar', 'action', {
    package: '@deepseek-ai/dsh-client-ui-goal',
    availableAt: AVAILABLE_BOTH,
    upstreamPath: 'packages/client/ui-goal/src/client/GoalBar.module.css',
    mappedClass: 'iconBtn',
  }),
  reforkVariant('Tag', 'version', {
    package: '@deepseek-ai/dsh-client-ui-plugin-manager',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css',
    mappedClass: 'versionTag',
  }),
  reforkVariant('Tag', 'status', {
    package: '@deepseek-ai/dsh-client-ui-plugin-manager',
    availableAt: AVAILABLE_LATEST,
    upstreamPath: 'packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css',
    mappedClass: 'statusTag',
  }),
]
