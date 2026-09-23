export type LiveSnapshot = {
  active: boolean;
  turn: number | null;
  fileCount: number;
  insertions: number;
  deletions: number;
};
export type SummaryPayload = {
  sessionId: string;
  isGit: boolean;
  workspaceRoot: string | null;
  unavailableReason: string | null;
  turns: Array<{
    turn: number;
    fileCount: number;
    insertions: number;
    deletions: number;
    unavailable: string | null;
    /**
     * 该轮是否建立过 before/after 快照（refs 是否留下）。与 `unavailable` 配合区分两种失败：
     * 连基线都没有 = 这一轮从没有过变更基线；基线在而 after 结算失败 = 承诺过的快照落空了。
     */
    hasBaseline: boolean;
    truncated: boolean;
    files: TurnFileChange[];
    skippedOversized: string[];
    skippedNestedRepos: string[];
  }>;
};
export type TurnFileChange = {
  /** 相对 worktree 根的路径。 */
  path: string;
  /** A=本 turn 新增，M=修改，D=删除。 */
  status: TurnFileStatus;
  /** 文本行新增数；二进制为 null。 */
  insertions: number | null;
  /** 文本行删除数；二进制为 null。 */
  deletions: number | null;
  /** 是否为二进制差异。 */
  binary: boolean;
};
export type TurnFileStatus = "A" | "M" | "D";
export interface GetLiveQuery {
  sessionId?: string;
}
export interface GetSummaryQuery {
  sessionId?: string;
}
