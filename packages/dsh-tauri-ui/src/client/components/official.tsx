// 引用源 @deepseek-ai/dsh-client-ui-primitives · packages/client/ui-primitives/src/ · 版本 0.1.7-alpha.1（≥0.1.5-rc.1）· hash 官方原样（无 refork 类）
/**
 * 官方 `@deepseek-ai/dsh-client-ui-primitives` 的直通转发层。
 *
 * 只转发 **0.1.5-rc.1 与 0.1.7-alpha.1 都导出** 的成员（判定依据见 `registry.ts` 的
 * `availableAt`）：两代内核拿到同一个官方实现，本包不复制样式，也不制造版本漂移。
 *
 * 仅 0.1.7 才有的组件必须在本目录 refork（`checkbox`、`segmented-control` 就是先例），
 * 否则在 0.1.5 内核上取到 `undefined` 并触发 React #130（`Element type is invalid …`）。
 *
 * `Button` / `Tag` 已由本目录的 `button.tsx` / `tag.tsx` 接管（单组件内分发：官方 variant
 * 继续走官方实现，本地 variant 走 refork 样式），故不在此转发。
 *
 * 不在此转发官方 icons 桶：两代导出名不同（`IconXxx16` → `IconXxxRegular`），图标
 * 统一走 `@gravity-ui/icons`（见 `icons.tsx`）。也不转发 `ReferenceIcon` / `LinkIcon`：
 * 0.1.7 已删除这两个名字，改为 `ReferenceIcon{Regular,Medium}` / `LinkIcon{Regular,Medium}`。
 */

export {
  BrandWordmark,
  classifyFileType,
  classifyLinkPath,
  CodeBlock,
  ConnectionIndicator,
  DEFAULT_DIFF_MAX_LINES,
  DEFAULT_READ_MAX_LINES,
  DEFAULT_SEARCH_MAX_LINES,
  DEFAULT_TERMINAL_MAX_LINES,
  DiffBlock,
  diffTotals,
  DisclosureRow,
  extractMarkdownPlainText,
  fileExtension,
  fileSizeText,
  FileTypeIcon,
  FISH_LOGO_PATH,
  FISH_LOGO_VIEWBOX,
  FishLogo,
  HoverCard,
  Input,
  JsonBlock,
  JsonTree,
  MarkdownText,
  Menu,
  Modal,
  OnboardingSurface,
  Pill,
  projectUserText,
  rankByName,
  ReadBlock,
  relativeTime,
  RiskConfirmation,
  SearchBlock,
  StateDot,
  Switch,
  TerminalBlock,
  Toast,
  Tooltip,
  WebBlock,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'

export type {
  AnchoredPositionOptions,
  BrandWordmarkProps,
  CodeBlockProps,
  ConnectionIndicatorState,
  DiffBlockLabels,
  DiffBlockProps,
  DiffHunk,
  DisclosureRowProps,
  FileType,
  FileTypeIconProps,
  FileTypeKind,
  FileTypeProjectContext,
  JsonTreeLabels,
  JsonTreeProps,
  LinkIconKind,
  LinkIconProps,
  MarkdownCodeLabels,
  MarkdownFileMentions,
  MarkdownLabels,
  MarkdownPathImages,
  MarkdownPlainTextMode,
  MarkdownPlainTextOptions,
  MenuEntry,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  ReadBlockLabels,
  ReadBlockLine,
  ReadBlockProps,
  ReferenceIconKind,
  ReferenceIconProps,
  RelativeTime,
  RelativeTimeUnit,
  RiskConfirmationProps,
  SearchBlockLabels,
  SearchBlockLineMatch,
  SearchBlockProps,
  SearchFileGroup,
  SearchMatchesBlockProps,
  SearchPathsBlockProps,
  StateDotState,
  TerminalBlockLabels,
  TerminalBlockProps,
  TooltipSide,
  WebBlockLabels,
  WebBlockProps,
  WebFetchBlockProps,
  WebSearchBlockProps,
  WebSourceView,
} from '@deepseek-ai/dsh-client-ui-primitives'
