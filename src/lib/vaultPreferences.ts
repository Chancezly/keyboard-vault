import { stringify } from 'yaml'
import { parsePreferencesMarkdown } from './parser'
import type { UserPreferences } from './types'
import type { VaultHandle } from './fs'

export const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteLayouts: [], favoriteProfiles: [], favoriteSwitchTypes: [], favoriteBrands: [],
  budgetRange: [0, 5000], notes: '',
}

export function serializePreferences(preferences: UserPreferences): string {
  const specification = {
    favoriteLayouts: preferences.favoriteLayouts,
    favoriteProfiles: preferences.favoriteProfiles,
    favoriteSwitchTypes: preferences.favoriteSwitchTypes,
    favoriteBrands: preferences.favoriteBrands,
    budgetRange: preferences.budgetRange,
  }
  return `---\n${stringify({ specification }).trimEnd()}\n---\n\n${preferences.notes.trim()}\n`
}

export async function readVaultPreferences(handle: VaultHandle): Promise<UserPreferences> {
  try {
    const settings = await handle.getDirectoryHandle('settings')
    const file = await settings.getFileHandle('user.md').then((entry) => entry.getFile())
    return parsePreferencesMarkdown(await file.text())
  } catch {
    return { ...DEFAULT_PREFERENCES, budgetRange: [...DEFAULT_PREFERENCES.budgetRange] }
  }
}

export async function writeVaultPreferences(handle: VaultHandle, preferences: UserPreferences): Promise<void> {
  const settings = await handle.getDirectoryHandle('settings', { create: true })
  const file = await settings.getFileHandle('user.md', { create: true })
  const writable = await file.createWritable()
  await writable.write(serializePreferences(preferences))
  await writable.close()
}
