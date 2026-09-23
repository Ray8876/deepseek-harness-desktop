import type { SchedulerTask } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executor } from './executor'
import { scheduler } from './scheduler'
import { task } from './task'

vi.mock('./executor', () => ({ executor: { run: vi.fn() } }))

vi.mock('./task', () => ({ task: { get: vi.fn(), list: vi.fn(), advance: vi.fn() } }))

const taskFixture: SchedulerTask = {
  id: 'task-1',
  name: 'nightly',
  schedule: { kind: 'interval', everyMinutes: 30, timeZone: 'UTC' },
  prompt: 'run the nightly job',
  enabled: true,
  createdAt: '2025-12-31T00:00:00.000Z',
  updatedAt: '2025-12-31T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('scheduler.trigger', () => {
  it('同一任务执行中时拒绝再次触发', async () => {
    vi.mocked(task.get).mockResolvedValue(taskFixture)
    vi.mocked(executor.run).mockReturnValue(new Promise<never>(() => {}))

    await expect(scheduler.trigger('task-1')).resolves.toEqual({ ok: true })
    await expect(scheduler.trigger('task-1')).resolves.toEqual({ ok: false, error: '任务正在执行中' })
    expect(executor.run).toHaveBeenCalledTimes(1)
  })

  it('任务不存在时返回领域错误，且不触发执行', async () => {
    vi.mocked(task.get).mockResolvedValue(null)

    await expect(scheduler.trigger('missing')).resolves.toEqual({ ok: false, error: '任务不存在' })
    expect(executor.run).not.toHaveBeenCalled()
  })

  it('手动触发以 manual 语义执行，并按 schedule 推进 nextRunAt', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      vi.mocked(task.get).mockResolvedValue({ ...taskFixture, id: 'task-2', nextRunAt: undefined })
      vi.mocked(executor.run).mockResolvedValue({ ok: true })
      vi.mocked(task.advance).mockResolvedValue(undefined)

      await expect(scheduler.trigger('task-2')).resolves.toEqual({ ok: true })
      await vi.advanceTimersByTimeAsync(0)

      expect(executor.run).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-2' }), 'manual')
      expect(task.advance).toHaveBeenCalledWith('task-2', '2026-01-01T00:00:00.000Z', '2026-01-01T00:30:00.000Z')
    }
    finally {
      vi.useRealTimers()
    }
  })
})
