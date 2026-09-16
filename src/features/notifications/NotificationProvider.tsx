import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import {
  NotificationContext,
  type NotificationApi,
  type NotificationInput,
  type NotificationTone,
} from './notification'

interface NotificationRecord extends NotificationInput {
  id: string
  tone: NotificationTone
}

const DEFAULT_DURATION: Record<NotificationTone, number> = {
  success: 3200,
  info: 4200,
  error: 6500,
}

const TONE_STYLES: Record<NotificationTone, string> = {
  success: 'border-emerald-400/25 bg-emerald-950/90 text-emerald-100',
  error: 'border-red-400/25 bg-red-950/90 text-red-100',
  info: 'border-sky-400/25 bg-slate-950/90 text-sky-100',
}

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} satisfies Record<NotificationTone, typeof Info>

function createNotificationId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer != null) window.clearTimeout(timer)
    timers.current.delete(id)
    setNotifications((current) => current.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (input: NotificationInput) => {
      const id = createNotificationId()
      const tone = input.tone ?? 'info'
      const duration = input.duration ?? DEFAULT_DURATION[tone]
      setNotifications((current) => [...current, { ...input, id, tone }].slice(-4))
      if (duration > 0) {
        timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
      }
      return id
    },
    [dismiss],
  )

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer))
      timers.current.clear()
    },
    [],
  )

  const api = useMemo<NotificationApi>(
    () => ({
      notify,
      dismiss,
      success: (title, message) => notify({ title, message, tone: 'success' }),
      error: (title, message) => notify({ title, message, tone: 'error' }),
      info: (title, message) => notify({ title, message, tone: 'info' }),
    }),
    [dismiss, notify],
  )

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-[360px]"
        aria-live="polite"
        aria-atomic="false"
      >
        {notifications.map((notification) => {
          const Icon = TONE_ICONS[notification.tone]
          return (
            <div
              key={notification.id}
              role={notification.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full rounded-2xl border px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl ${TONE_STYLES[notification.tone]}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-5">{notification.title}</p>
                  {notification.message ? (
                    <p className="mt-0.5 break-words text-[12px] leading-5 opacity-70">
                      {notification.message}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(notification.id)}
                  className="-mr-1 -mt-1 rounded-lg p-1.5 opacity-60 transition-opacity hover:bg-white/10 hover:opacity-100"
                  aria-label="关闭通知"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </NotificationContext.Provider>
  )
}
