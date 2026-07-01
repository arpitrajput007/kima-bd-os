'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export const TIME_STORAGE_KEY = 'kima_time_v1'
const TICK_SEC = 5  // add 5 seconds every tick while tab is active

export interface DayData {
  total: number               // seconds
  byPage: Record<string, number>  // pathname → seconds
}

export function readTimeData(): Record<string, DayData> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(TIME_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function writeTimeData(data: Record<string, DayData>) {
  localStorage.setItem(TIME_STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new Event('kima_time_update'))
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TimeTracker() {
  const pathname = usePathname()
  const activeRef = useRef(true)

  useEffect(() => {
    const onVisibility = () => { activeRef.current = !document.hidden }
    const onFocus     = () => { activeRef.current = true }
    const onBlur      = () => { activeRef.current = false }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    const interval = setInterval(() => {
      if (!activeRef.current) return
      const data = readTimeData()
      const today = todayKey()
      if (!data[today]) data[today] = { total: 0, byPage: {} }
      data[today].total += TICK_SEC
      data[today].byPage[pathname] = (data[today].byPage[pathname] || 0) + TICK_SEC
      writeTimeData(data)
    }, TICK_SEC * 1000)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [pathname])

  return null
}
