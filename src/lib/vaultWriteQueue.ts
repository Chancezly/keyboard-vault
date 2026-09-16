import type { VaultHandle } from './fs'

const tails = new WeakMap<object, Promise<void>>()

/** 同一收藏库的写操作严格串行；前一项失败不会阻塞后续任务。 */
export function enqueueVaultWrite<T>(
  handle: VaultHandle,
  operation: () => Promise<T>,
): Promise<T> {
  const key = handle as unknown as object
  const previous = tails.get(key) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(operation)
  const settled = run.then(
    () => undefined,
    () => undefined,
  )
  tails.set(key, settled)
  void settled.finally(() => {
    if (tails.get(key) === settled) tails.delete(key)
  })
  return run
}
