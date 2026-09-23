/**
 * host/config/constants.ts — 宿主侧静态常量。
 *
 * 上限与原因码集中在此：捕获路径与容量治理共用同一组判定，
 * 避免「预览说超限、执行却照做」这类双份常量漂移。
 */

import {
  PLUGIN_ID,
  RUNNING_CHANGES_REASON_EXPIRED,
  RUNNING_CHANGES_REASON_GIT_REQUIRED,
  RUNNING_CHANGES_REASON_SNAPSHOT_FAILED,
  RUNNING_CHANGES_REASON_UNSAFE_PATH,
  RUNNING_CHANGES_REASON_WORKSPACE_BUSY,
} from '../../shared/constants'

/** 私有快照仓中快照 ref 的命名空间前缀。 */
/** 每个工作区私有快照仓与每会话账本的存放目录（DSH_HOME 下）。 */
export const SNAPSHOT_FEATURE_DIR = PLUGIN_ID

/** 账本子目录（`$DSH_HOME/<feature>/sessions`）。 */
export const LEDGER_SUBDIR = 'sessions'

/** 账本文件版本；字段或折叠语义变更时递增。 */
export const LEDGER_VERSION = 1

/** 保留快照 refs 的最近 turn 数；更老的 turn 标记过期（保留审计行、删除 refs）。 */
export const MAX_TURNS_PER_SESSION = 50

/** 每会话账本行的硬上限（审计窗口），超过即丢弃最老的行。 */
export const MAX_TURN_RECORDS = 200

/**
 * 单个文件超过此字节数即从快照中排除并在记录里标注（不是让整轮不可用）。
 * 这不是内存上限，而是防止单个巨大产物撑爆私有仓。
 */
export const MAX_FILE_BYTES = 64 * 1024 * 1024

/** 单次快照的聚合字节上限；超过则该 turn 记 unavailable。 */
/** 单 turn 允许纳入快照的最大文件数；超过即该 turn 记 unavailable。 */
/** 一次预扫最多排除多少个超限文件；超过则该 turn 记 unavailable（避免 argv 爆炸）。 */
/** 私有快照仓容量上限（MB）；超过即整仓隔离重建（旧 turn 全部转过期）。 */
/** 单条 git 子进程的墙钟超时（快照/差异统计等重活）。 */
export const GIT_TIMEOUT_MS = 5 * 60 * 1000

/** 资格探测的墙钟超时：探测结果挂在 pre-step 执行屏障上，不能用重活预算。 */
/** 工作区解析结果缓存 TTL（冷未命中才同步探测，过期先回缓存值再后台刷新）。 */
/** 工作区解析缓存的条目上限。 */
/** 摘要路由返回给客户端的文件明细上限（更大的会话只给汇总与截断标记）。 */
/** 摘要路由每条 turn 最多回传多少个「未纳入快照范围」的路径。 */
/** 运行中实时读数的宿主端刷新间隔（客户端只读缓存值，轮询频率与 git 调用解耦）。 */
/** 会话 cwd 不在 Git worktree 内：不做快照。 */
export const REASON_GIT_REQUIRED = RUNNING_CHANGES_REASON_GIT_REQUIRED

/** PATH 上没有 git：必须与「不是 Git 仓库」区分，否则用户会去 git init 一个不存在的 git。 */
/** 会话 cwd 是家目录/家目录祖先/盘根等系统目录：拒绝快照。 */
export const REASON_UNSAFE_WORKSPACE = 'RUNNING_CHANGES_UNSAFE_WORKSPACE'

/** 快照文件数超限。 */
/** 快照聚合字节超限。 */
/** 超限文件太多，无法逐个排除（该轮不提供变更明细）。 */
/** 快照或统计过程失败（git 异常、仓库损坏等）。 */
export const REASON_SNAPSHOT_FAILED = RUNNING_CHANGES_REASON_SNAPSHOT_FAILED

/** 快照仓被隔离重建 / 手工删除，该 turn 的 refs 已不存在。 */
export const REASON_EXPIRED = RUNNING_CHANGES_REASON_EXPIRED

/** 目标路径的父级是符号链接/junction，拒绝穿透（防路径逃逸）。 */
export const REASON_UNSAFE_PATH = RUNNING_CHANGES_REASON_UNSAFE_PATH

/** 目标路径当前是非空目录：不递归删除目录。 */
export const REASON_NON_EMPTY_DIR = 'RUNNING_CHANGES_NON_EMPTY_DIR'

/** 工作区被另一个宿主进程占用（跨进程锁等待超时）。 */
export const REASON_WORKSPACE_BUSY = RUNNING_CHANGES_REASON_WORKSPACE_BUSY

/** 旧版单文件锁协议的围栏/诊断目录（真正互斥由内核监听句柄持有，见 utils/lock.ts）。 */
export const LOCK_DIR_NAME = 'locks'

/**
 * 跨进程锁的等待上限：与 git 重活同预算。
 *
 * 拿到锁意味着「轮到我动这个工作区的私有仓」，而一次捕获/结算本身就是 git 重活
 * （大仓库首次要几十秒），所以等待时长必须覆盖对方**一整次操作**。等不到就给调用方
 * 一个明确的结论（捕获照实记不可用）。没有任何 TTL 接管活锁的通道：
 * 持有者挂死时这里就是唯一的收口——如实报「占用」，宁可暂时不可用也不去抢一把活着的锁。
 */
export const LOCK_WAIT_TIMEOUT_MS = GIT_TIMEOUT_MS

/** 屏障任务开始前的 FIFO 与争锁等待预算；治理和 before 在一次持锁内完整执行。 */
export const LOCK_BARRIER_TIMEOUT_MS = 20 * 1000

/** 锁竞争时的重试间隔：轮询粒度，太小会空转 I/O，太大则让短临界区白等。 */
export const LOCK_RETRY_INTERVAL_MS = 200
