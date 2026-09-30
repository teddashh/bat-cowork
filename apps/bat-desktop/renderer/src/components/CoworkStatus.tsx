import { useEffect, useState } from 'react'
import { host } from '../host-api'

interface TaskRow {
  id: string
  phase: string
  holdDispatch: boolean
  receipts: { kind: string; failed: boolean }[]
  timeline: { kind: string; text: string }[]
}

interface SessionRow {
  id: string
  title?: string | null
  provider?: string
}

export function CoworkStatus() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      try {
        const [nextSessions, nextTasks] = await Promise.all([
          host.cowork.sessions(),
          host.cowork.tasks(),
        ])
        if (stopped) return
        setSessions(nextSessions)
        setTasks(nextTasks)
      } catch {
        if (!stopped) {
          setSessions([])
          setTasks([])
        }
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  if (sessions.length === 0 && tasks.length === 0) return null

  return (
    <div
      className="cowork-status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '4px 12px',
        fontSize: '12px',
        borderBottom: '1px solid var(--border, #333)',
      }}
    >
      <span>
        Sessions{' '}
        {sessions
          .map((session) => session.title || session.provider
            ? `${session.id} (${session.title || session.provider})`
            : session.id)
          .join(', ')}
      </span>
      {tasks.map((task) => {
        const failed = task.receipts.some((receipt) => receipt.failed)
        const receipt = task.receipts.length === 0
          ? ''
          : failed
            ? ' receipt-failed'
            : ` receipt:${task.receipts.map((item) => item.kind).join('+')}`
        const last = [...task.timeline].reverse().find((entry) => entry.text)
        return (
          <span key={task.id}>
            {task.id}:{task.phase}{task.holdDispatch ? ' held' : ''}{receipt}
            {last ? ` — ${last.kind}: ${last.text}` : ''}
          </span>
        )
      })}
    </div>
  )
}