import { createContext, useContext } from 'react'

export type NotificationTone = 'success' | 'error' | 'info'

export interface NotificationInput {
  title: string
  message?: string
  tone?: NotificationTone
  duration?: number
}

export interface NotificationApi {
  notify: (input: NotificationInput) => string
  dismiss: (id: string) => void
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
}

export const NotificationContext = createContext<NotificationApi | null>(null)

export function useNotifications(): NotificationApi {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications 必须在 NotificationProvider 内使用')
  return context
}
