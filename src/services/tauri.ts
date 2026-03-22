import { invoke } from '@tauri-apps/api/core'
import type { Setting } from './types'

// Settings commands
export async function checkSetupComplete(): Promise<boolean> {
  return invoke<boolean>('check_setup_complete')
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key })
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>('set_setting', { key, value })
}

export async function getAllSettings(): Promise<Setting[]> {
  return invoke<Setting[]>('get_all_settings')
}
