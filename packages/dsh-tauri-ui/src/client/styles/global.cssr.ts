import { cssr } from '../utils/cssr'

export const GLOBAL_STYLE_ID = 'dsh-tauri-ui-global-styles'

const { c } = cssr

export default c([
  c('[data-slot="sidebar.right.tab.guide"]', [
    c('[class$="guide"]', {
      gap: '8px',
    }),
    c('[class$="entry"]', {
      border: 'none',
      padding: '8px 16px',
      gap: '12px',
      minHeight: 'auto',
      alignItems: 'start',
    }),
    c('[class$="entry"]>button', {
      border: 'none',
      padding: '8px 16px',
      gap: '12px',
      minHeight: 'auto',
      alignItems: 'start',
    }),
    c('[class$="entryIcon"], [class$="icon"]', {
      marginTop: '2px',
      width: '18px',
      height: '18px',
    }),
    c('[class$="entryTitle"], [class$="title"]', {
      fontSize: '14px',
    }),
    c('[class$="entryDescription"], [class$="description"]', {
      fontSize: '12px',
    }),
  ]),
  c('[data-dsh-toggle-cluster], .nArs4W_toggleCluster', {
    top: '6px !important',
    right: '6px !important',
    gap: '2px !important',
  }),
  c('[data-dsh-toggle-cluster] button[aria-label], .nArs4W_toggleCluster button[aria-label]', {
    display: 'flex !important',
    borderRadius: '8px !important',
    flexShrink: 0,
  }),
  c('[class$="_panelRow"], [class*="_panelRow "]', {
    color: 'var(--dsw-alias-label-primary) !important',
  }),
  c('[class$="logoRow"]', {
    color: 'var(--dsw-alias-label-primary) !important',
    justifyContent: 'center !important',
  }, [
    // 官方侧边栏自带的折叠 toggle。桌面壳 navbar 已有自己的
    // `dsh-navbar-sidebar-toggle`（`dsh://sidebar:toggle` → `ctx.layout.toggleSidebar`），
    // 官方这枚在**展开态**是重复入口；折叠态不能隐藏它（见下一条）。
    c('[class$="toggle"], [class*="toggle "]', {
      display: 'none !important',
    }),
    // 官方品牌按钮的类名是 `clsx(brand, wide)`，类属性以 `_wide` 结尾，
    // 仅靠 `[class$="brand"]` 匹配不到；两种形态都列上。
    // 品牌按钮带 `flex: 1` 铺满整行，所以「logo 居中」要落在它自己身上，而不是行容器。
    c('[class$="brand"], [class*="brand "]', {
      justifyContent: 'center !important',
    }),
  ]),
  // 折叠轨道（rail）的 logo 就画在这枚 toggle 里（官方 `railMark` 鲸鱼，悬停换成展开图标）：
  // 上一条隐藏规则若在折叠态也命中，rail 上的 logo 会整块消失。这里按更高特异性把它恢复回来。
  c('[class*="collapsed"] [class$="logoRow"] [class$="toggle"]', {
    display: 'inline-flex !important',
  }),
  // 折叠轨道回到官方左对齐：上一条 `!important` 会盖掉官方 `.collapsed .logoRow`。
  c('[class*="collapsed"] [class$="logoRow"]', {
    justifyContent: 'flex-start !important',
  }),
  c('[data-slot="conversation.chat.turnTail"]', [
    c('[class$="card"]', {
      borderRadius: '14px !important',
    }),
    c('[class$="toggle"]', {
      borderTop: '.5px solid var(--dsw-alias-border-l2)',
    }),
    c('[class$="statCounts"]', {
      fontSize: '12px',
    }),
    c('[class$="title"]', {
      fontWeight: '550',
    }),
    c('[class$="tile"]', {
      border: 'none',
      background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))',
    }),
    c('[class$="tileMark"]', {
      background: 'var(--dsw-alias-label-primary)',
    }),
  ]),

  c('[class$="sidebarCol"]', {
    borderRight: 'none !important',
  }),
  // 官方的中栏是「别名底色 + 左上 16px 圆角」，声明挂在文档根属性 `[data-windows-titlebar]`
  // 上（dsh-client-ui-layout），该属性由官方桌面宿主写入；本仓壳层不写，中栏透明就会整块
  // 露出布局帧的侧栏底色（插件页一并变灰）。故按类名后缀补等价声明。
  // 不加 `!important`：官方 `[data-platform=darwin] .centerCol` 等更高特异性的声明须继续压过本条。
  c('[class$="centerCol"]', {
    background: 'var(--dsw-alias-bg-base)',
    borderRadius: '16px 0 0 0',
    cornerShape: 'round',
  }),
  c('[data-slot="root"] > div', {
    background: 'var(--dsw-specific-sidebar-fill)',
  }),
])
