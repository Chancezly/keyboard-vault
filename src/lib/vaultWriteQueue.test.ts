import { describe, expect, it } from 'vitest'
import { enqueueVaultWrite } from './vaultWriteQueue'
import type { VaultHandle } from './fs'

const handle = () => ({}) as VaultHandle

describe('vault write queue', () => {
  it('runs writes for the same vault one at a time in request order', async () => {
    const vault = handle()
    const events: string[] = []
    let releaseFirst = () => {}
    let markStarted = () => {}
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const started = new Promise<void>((resolve) => { markStarted = resolve })

    const first = enqueueVaultWrite(vault, async () => {
      events.push('first:start')
      markStarted()
      await gate
      events.push('first:end')
    })
    const second = enqueueVaultWrite(vault, async () => {
      events.push('second:start')
      events.push('second:end')
    })

    await started
    expect(events).toEqual(['first:start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('continues with later writes after a failed operation', async () => {
    const vault = handle()
    const failed = enqueueVaultWrite(vault, async () => { throw new Error('failed') })
    const succeeded = enqueueVaultWrite(vault, async () => 'saved')

    await expect(failed).rejects.toThrow('failed')
    await expect(succeeded).resolves.toBe('saved')
  })

  it('does not block writes to different vaults', async () => {
    const events: string[] = []
    let release = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const first = enqueueVaultWrite(handle(), async () => { await gate })
    const second = enqueueVaultWrite(handle(), async () => { events.push('other') })

    await second
    expect(events).toEqual(['other'])
    release()
    await first
  })
})
