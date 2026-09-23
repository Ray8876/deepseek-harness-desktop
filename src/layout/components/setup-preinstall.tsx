import type { PreinstallPlugin } from '@/store/modules/preinstall'
import { ArrowUpRightFromSquare, Copy, PlugConnection, Xmark } from '@gravity-ui/icons'
import { Button, Card, Chip, ScrollShadow, Spinner, Switch, Typography } from '@heroui/react'
import { useMount } from '@reause/core'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Else, If, Then } from 'react-if-lite'
import { useStore } from 'valtio-define'
import { Ellipsis } from '@/components/ellipsis'
import { Empty } from '@/components/empty'
import { Logs } from '@/components/logs'
import { store } from '@/store'
import { writeClipboardText } from '@/utils/clipboard'

/**
 * 预装插件引导页：首次安装（或老版本升级）后展示推荐插件列表，
 * 用户确认后调用 `dsh plugin` 安装（日志实时回流到控制台），
 * 或跳过；两者都会标记完成并继续启动服务。
 */

/**
 * 初始勾选态 = 已安装 + 推荐/修复/默认勾选（进入页面时的完整勾选集合）。
 * 用于和用户最终选择做 diff，得出 toInstall / toUninstall。
 *
 * 策略由 isFirstTime 决定：
 * - 首次安装引导（isFirstTime=true）：已安装 + 推荐/修复/默认勾选均默认勾上，
 *   但显式声明 `defaultUnchecked` 的推荐项不预选（标着「推荐」仍交由用户决定）
 * - 手动打开（isFirstTime=false）：只有已安装的插件才默认勾上（已卸载的推荐项不勾）
 */
function initialCheckedSet(plugins: readonly PreinstallPlugin[], isFirstTime: boolean): Set<string> {
  return new Set(plugins.filter((p) => {
    // 超出支持上限的插件不可选：既不预选，也不参与安装 diff
    if (p.unsupported)
      return false
    if (p.installed)
      return true
    // 非首次场景：不推荐未安装的插件，避免已卸载的推荐项仍默认勾着
    if (!isFirstTime)
      return false
    if (p.defaultUnchecked)
      return false
    return p.recommended || p.fix || p.defaultChecked
  }).map(p => p.id))
}

/** 插件卡片：图标 + 名称 + 状态 chip 在顶，描述居中，开关居底部右侧 */
function PluginCard({ plugin, checked, toUninstall, disabled, onToggle, onOpenRepo }: {
  plugin: PreinstallPlugin
  checked: boolean
  /** 已安装但被取消勾选 → 待卸载（警告 chip） */
  toUninstall: boolean
  disabled: boolean
  onToggle: (id: string, checked: boolean) => void
  onOpenRepo: (id: string) => void
}) {
  const { t } = useTranslation()

  return (
    <Card
      className={`h-[124px] gap-1 rounded-lg border border-line bg-panel2 p-3 shadow-none transition-colors ${plugin.unsupported ? 'opacity-60' : 'hover:border-line-strong'}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent/10 text-accent">
          <PlugConnection className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {plugin.name}
        </span>
        <If cond={plugin.recommended && !plugin.installed && !toUninstall && !plugin.unsupported}>
          <Chip size="sm" variant="soft" color="success" className="shrink-0 font-medium">
            {t('preinstall.recommend')}
          </Chip>
        </If>
        <If cond={plugin.fix && !plugin.installed && !toUninstall && !plugin.unsupported}>
          <Chip size="sm" variant="soft" color="warning" className="shrink-0 font-medium">
            {t('preinstall.fix')}
          </Chip>
        </If>
        <If cond={plugin.unsupported}>
          <Chip size="sm" variant="soft" color="danger" className="shrink-0 font-medium">
            {t('preinstall.unsupported_core')}
          </Chip>
        </If>
        <If cond={plugin.installed && !toUninstall}>
          <Chip size="sm" variant="soft" color="success" className="shrink-0 font-medium">
            {t('preinstall.installed')}
          </Chip>
        </If>
        <If cond={toUninstall}>
          <Chip size="sm" variant="soft" color="warning" className="shrink-0 font-medium">
            {t('preinstall.to_uninstall')}
          </Chip>
        </If>
      </div>

      <If cond={plugin.description !== ''}>
        <Ellipsis lineClamp={2} className="text-[11px] leading-[17px] text-muted">
          {plugin.description}
        </Ellipsis>
      </If>

      <div className="mt-auto flex items-center justify-between gap-2">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="size-6 shrink-0 rounded-md text-muted"
          aria-label={t('preinstall.open_repo', { name: plugin.name })}
          onPress={() => onOpenRepo(plugin.id)}
        >
          <ArrowUpRightFromSquare className="size-3" />
        </Button>
        <Switch
          size="sm"
          isSelected={checked}
          isDisabled={disabled || plugin.unsupported}
          onChange={isSelected => onToggle(plugin.id, isSelected)}
          aria-label={plugin.name}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
    </Card>
  )
}

/** 日志控制台：dsh plugin 进程输出，顶部带复制按钮，样式与安装/加载页日志面板一致 */
function LogPanel({ logs }: { logs: readonly string[] }) {
  const { t } = useTranslation()
  const text = logs.join('\n')

  async function copyLogs() {
    try {
      // 成功/失败提示由 writeClipboardText 统一给出，这里只记录日志
      await writeClipboardText(text || '', t('messages.log_copied'))
    }
    catch (err) {
      console.error('[Harness] copy preinstall logs failed:', err)
    }
  }

  return (
    <Logs
      logs={logs}
      limit={100}
      bodyClassName="max-h-[240px]"
      header={(
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          className="size-6 shrink-0 rounded-md"
          aria-label={t('buttons.copy')}
          onPress={copyLogs}
        >
          <Copy className="size-3.5" />
        </Button>
      )}
    />
  )
}

export function PreinstallSetup() {
  const { t } = useTranslation()
  const preinstall = useStore(store.preinstall)
  // 用户手动调整后的选择（一旦交互即接管默认勾选）
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [touched, setTouched] = useState(false)

  // 进入引导页时拉取插件列表（仅挂载一次，无需清理）
  useMount(() => {
    void store.preinstall.load()
  })

  // 默认勾选：已安装 + 未安装的推荐插件 +「修复」类项 + 无 chip 但标记默认勾选的项（如 dsh-notification）。
  // 派生计算而非在加载回调里 setState，避免与 store 的加载去重守卫竞争，
  // 保证插件到位后默认勾选必定生效（用户手动调整后以用户选择为准）。
  const effectiveSelected = !touched
    ? initialCheckedSet(preinstall.plugins, preinstall.isFirstTime)
    : selected

  function toggle(id: string, checked: boolean) {
    // 首次交互以「当前默认勾选」为起点：selected 初始为空，若直接在其上增删，
    // 取消一个会误把其余默认项一并取消。这里先以 initialCheckedSet 播种，
    // 再应用本次勾选，保证「取消一个 = 只取消这一个」。
    const seed = !touched ? initialCheckedSet(preinstall.plugins, preinstall.isFirstTime) : null
    setTouched(true)
    setSelected((prev) => {
      const next = new Set(seed ?? prev)
      if (checked) {
        next.add(id)
      }
      else {
        next.delete(id)
      }
      return next
    })
  }

  function openRepo(id: string) {
    void invoke('open_preinstall_repo', { id }).catch((err) => {
      console.error('[Harness] open preinstall repo failed:', err)
    })
  }

  function handleConfirm() {
    // 基于 plugin.installed 推导操作：选中且未安装 → 安装；已安装且未选中 → 卸载
    const toInstall = preinstall.plugins
      .filter(p => effectiveSelected.has(p.id) && !p.installed)
      .map(p => p.id)
    const toUninstall = preinstall.plugins
      .filter(p => p.installed && !effectiveSelected.has(p.id) && !p.unsupported)
      .map(p => p.id)
    void store.preinstall.confirm({ installIds: toInstall, uninstallIds: toUninstall })
  }

  function handleSkip() {
    void store.preinstall.skip()
  }

  // 是否有变更：存在需安装或需卸载的插件时启用"确定"
  const toInstallCount = preinstall.plugins.filter(p => effectiveSelected.has(p.id) && !p.installed).length
  const toUninstallCount = preinstall.plugins.filter(p => p.installed && !effectiveSelected.has(p.id) && !p.unsupported).length
  const hasChanges = toInstallCount > 0 || toUninstallCount > 0
  const installing = preinstall.installing

  return (
    <div className="flex h-full w-full items-center justify-center bg-canvas">
      <div className="flex w-[min(880px,92vw)] flex-col gap-4">
        <header className="flex flex-col items-center gap-1 text-center">
          <Typography type="h4" className="!text-ink">{t('preinstall.title')}</Typography>
          <Typography color="muted" type="body-sm" className="max-w-[440px]">{t('preinstall.subtitle')}</Typography>
        </header>

        <If
          cond={installing}
          else={(
            // 安装失败时不叠加插件列表，只展示错误 + 日志 + 重试/跳过
            <If
              cond={preinstall.error !== ''}
              else={(
                <>
                  {/* 卡片网格限定高度滚动，上下溢出由 ScrollShadow 渐隐提示 */}
                  <ScrollShadow className="max-h-[min(50vh,420px)]" size={36}>
                    <div className="grid grid-cols-1 gap-2.5 pr-1 sm:grid-cols-2 lg:grid-cols-3">
                      <If
                        cond={preinstall.loadError === ''}
                        else={(
                          // 列表加载失败（区别于空列表）：错误说明 + 重试
                          <div className="flex flex-col items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-center sm:col-span-2 lg:col-span-3">
                            <p className="text-xs font-medium text-danger">{t('preinstall.load_failed')}</p>
                            <p className="max-h-[80px] max-w-full overflow-y-auto break-all font-mono text-[11px] text-muted">
                              {preinstall.loadError}
                            </p>
                            <Button
                              className="h-8 rounded-md"
                              size="sm"
                              variant="primary"
                              onPress={() => void store.preinstall.load()}
                              isDisabled={preinstall.loading}
                            >
                              {t('app.retry')}
                            </Button>
                          </div>
                        )}
                      >
                        <If
                          cond={preinstall.plugins.length > 0}
                          else={(
                            <Empty className="sm:col-span-2 lg:col-span-3">{t('preinstall.empty')}</Empty>
                          )}
                        >
                          {preinstall.plugins.map((plugin) => {
                            const checked = effectiveSelected.has(plugin.id)
                            // 已安装但用户取消勾选 → 待卸载（超出支持上限的项不参与）
                            const toUninstall = plugin.installed && !checked && !plugin.unsupported
                            return (
                              <PluginCard
                                key={plugin.id}
                                plugin={plugin}
                                checked={checked}
                                toUninstall={toUninstall}
                                disabled={installing}
                                onToggle={toggle}
                                onOpenRepo={openRepo}
                              />
                            )
                          })}
                        </If>
                      </If>
                    </div>
                  </ScrollShadow>

                  {/* 可取消勾选提示：让用户知道预设插件可减选，取消后不会安装 */}
                  <If cond={preinstall.plugins.length > 0 && !installing && preinstall.error === ''}>
                    <p className="text-center text-xs text-muted">{t('preinstall.can_uncheck_hint')}</p>
                  </If>

                  {/* 操作区：有变更 → 弱「跳过」+ 主「确认」；无变更 → 主按钮独占「跳过」，避免重复入口 */}
                  <div className="flex items-center justify-end gap-2">
                    <If cond={hasChanges}>
                      <Button className="h-8 rounded-md" size="sm" variant="tertiary" data-testid="dsh-setup-preinstall-skip" onPress={handleSkip} isDisabled={installing}>
                        {t('preinstall.skip')}
                      </Button>
                    </If>
                    <If cond={!hasChanges}>
                      <Then>
                        <Button
                          className="h-8 rounded-md"
                          size="sm"
                          variant="primary"
                          data-testid="dsh-setup-preinstall-skip"
                          onPress={handleSkip}
                          isDisabled={installing}
                        >
                          {t('preinstall.skip')}
                        </Button>
                      </Then>
                      <Else>
                        <Button
                          className="h-8 rounded-md"
                          size="sm"
                          variant="primary"
                          onPress={handleConfirm}
                          isDisabled={installing}
                        >
                          {t('preinstall.confirm')}
                        </Button>
                      </Else>
                    </If>
                  </div>
                </>
              )}
            >
              {/* 安装失败：错误信息 + 日志 + 操作 */}
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-2 rounded-md border border-danger/30 bg-danger/5 p-3">
                  <p className="text-xs font-medium text-danger">{t('preinstall.failed')}</p>
                  <p className="max-h-[120px] overflow-y-auto break-all font-mono text-[11px] leading-relaxed text-muted">
                    {preinstall.error}
                  </p>
                </div>
                <LogPanel logs={preinstall.logs} />
                <div className="flex items-center justify-end gap-2">
                  <Button className="h-8 rounded-md" size="sm" variant="tertiary" onPress={handleSkip} isDisabled={installing}>
                    {t('preinstall.skip')}
                  </Button>
                  <Button
                    className="h-8 rounded-md"
                    size="sm"
                    variant="primary"
                    onPress={handleConfirm}
                    isDisabled={installing || !hasChanges}
                  >
                    {t('app.retry')}
                  </Button>
                </div>
              </div>
            </If>
          )}
        >
          {/* 安装中：spinner 在上、文案在下，图标旁不加文字 */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="md" color="current" />
              <p className="text-xs text-muted">{t('preinstall.installing')}</p>
            </div>
            <LogPanel logs={preinstall.logs} />
            {/* 取消安装：网络抖动/限流（429）时可能长时间卡在重试，给用户退出入口 */}
            <div className="flex items-center justify-center">
              <Button
                className="h-8 rounded-md"
                size="sm"
                variant="tertiary"
                onPress={store.preinstall.cancel}
                isDisabled={preinstall.cancelling}
              >
                <Xmark className="size-3.5" />
                {preinstall.cancelling ? t('preinstall.cancelling') : t('preinstall.cancel')}
              </Button>
            </div>
          </div>
        </If>
      </div>
    </div>
  )
}
