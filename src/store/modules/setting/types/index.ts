export interface AppSetting {
  /** 依赖是否已安装（boot 流程据此决定是否走安装与更新检查） */
  installed: boolean
  port: number
  harness_max_heap_mb: number | null
  auto_start: boolean
  cli_link_enabled: boolean
  zoom_factor: number
  close_action: string
  backup_retention_count: number
  backup_include_credentials: boolean
}

export interface AppSettingUpdate {
  port?: number
  harnessMaxHeapMb?: number
  autoStart?: boolean
  cliLinkEnabled?: boolean
  closeAction?: string
  backupRetentionCount?: number
  backupIncludeCredentials?: boolean
}

export type ZoomAction = 'increase' | 'decrease' | 'reset'
