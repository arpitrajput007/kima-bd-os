'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Inbox,
  Database,
  MessageSquare,
  Settings2,
  Brain,
  BarChart3,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  Activity,
  BookOpen,
  Mic,
  Sun,
  Kanban,
  Bot,
  Shield,
  CreditCard,
  LineChart,
  PenLine,
  ShieldCheck,
  DollarSign,
  Send,
  Globe,
  FileDown,
  Clock,
  CalendarClock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { readTimeData } from '@/components/TimeTracker'

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0 && m === 0) return '< 1m'
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const navGroups: {
  label: string
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; glow?: boolean; voice?: boolean; cyan?: boolean; orange?: boolean }[]
}[] = [

  {
    label: 'Intelligence',
    items: [
      { href: '/copilot',         label: 'AI Co-Pilot',        icon: Bot, glow: true },
      { href: '/aergap-copilot',     label: 'Aergap Co-Pilot',      icon: ShieldCheck, cyan: true },
      { href: '/aergap-web2-copilot', label: 'Web2 Co-Pilot',       icon: Globe,       orange: true },
      { href: '/today',           label: "Today's Plan",        icon: Sun },
      { href: '/dashboard',       label: 'BD Command Center',   icon: LayoutDashboard },
      { href: '/leads',           label: 'Lead Inbox',          icon: Inbox },
      { href: '/crm',             label: 'CRM',                 icon: Kanban },
      { href: '/learn',           label: 'Make Agent Learn',    icon: BookOpen, glow: true },
      { href: '/voice',           label: 'Voice Chat',          icon: Mic, voice: true },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/monthly-reports',   label: 'Monthly Performance',  icon: CalendarClock, glow: true },
      { href: '/export-reports',   label: 'Export Reports',       icon: FileDown },
      { href: '/reports',          label: 'Weekly Learning',      icon: BarChart3 },
    ],
  },
  {
    label: 'AI Agents',
    items: [
      { href: '/aeredium',              label: 'Aeredium Targets',      icon: Shield,     glow: true },
      { href: '/agentic-payments',      label: 'Agentic Payments',      icon: CreditCard, glow: true },
      { href: '/money-touching-agents',  label: 'Money Touching Agents', icon: DollarSign, glow: true },
      { href: '/web2-agent-companies',  label: 'Web2 Agent Companies',  icon: Globe,      orange: true },
    ],
  },
  {
    label: 'Automation',
    items: [
      { href: '/sources',            label: 'Discovery Sources',  icon: Database },
      { href: '/outreach',           label: 'Outreach Studio',    icon: MessageSquare },
      { href: '/reachout-storage',   label: 'Reachout Storage',   icon: Send },
      { href: '/content',            label: 'Content Studio',     icon: PenLine, glow: true },
      { href: '/agent-rules',        label: 'Agent Rules',        icon: Settings2 },
      { href: '/feedback',           label: 'Feedback Memory',    icon: Brain },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings',       label: 'Settings',        icon: Settings   },
      { href: '/my-performance', label: 'My Performance',  icon: LineChart  },
      { href: '/time-tracker',   label: 'Time Tracker',    icon: Clock      },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [apiIssues, setApiIssues] = useState<string[]>([])
  const [todayTime, setTodayTime] = useState(0)

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('bd_api_issues')
        setApiIssues(raw ? (JSON.parse(raw) as string[]) : [])
      } catch { setApiIssues([]) }
    }
    load()
    const handler = () => load()
    window.addEventListener('bd_api_health_update', handler)
    return () => window.removeEventListener('bd_api_health_update', handler)
  }, [])

  useEffect(() => {
    const load = () => {
      const data = readTimeData()
      setTodayTime(data[todayISO()]?.total || 0)
    }
    load()
    window.addEventListener('kima_time_update', load)
    return () => window.removeEventListener('kima_time_update', load)
  }, [])

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0 transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[68px]' : 'w-[248px]'
      )}
      style={{
        background: 'rgb(12, 13, 20)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Logo ─────────────────────────────────── */}
      <div
        className={cn('flex items-center gap-3 px-4 border-b flex-shrink-0', collapsed && 'justify-center')}
        style={{ borderColor: 'rgba(255,255,255,0.06)', height: '60px' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 2px 12px rgba(124,58,237,0.4)' }}
        >
          <Zap size={15} color="white" fill="white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-[13px] leading-none tracking-tight">Kima BD OS</div>
            <div className="text-[11px] mt-0.5 font-medium" style={{ color: 'rgba(167,139,250,0.7)' }}>AI BD Engine</div>
          </div>
        )}
      </div>

      {/* ── Live status bar ───────────────────────── */}
      {!collapsed && (
        <div className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(52,211,153,0.04)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse flex-shrink-0" />
          <span className="text-[11px] font-semibold" style={{ color: 'rgb(52,211,153)' }}>Agent Active · Discovering 24/7</span>
        </div>
      )}

      {/* ── Nav ──────────────────────────────────── */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-0.5">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {!collapsed && (
              <div className="nav-section-label">{group.label}</div>
            )}
            {collapsed && gi > 0 && (
              <div className="my-2 mx-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} />
            )}
            {group.items.map(({ href, label, icon: Icon, glow, voice, cyan, orange }) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              const hasApiAlert = href === '/settings' && apiIssues.length > 0
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn('nav-item', isActive && 'active', collapsed && 'justify-center px-0')}
                  title={collapsed ? label : undefined}
                  style={orange && !isActive ? {
                    background: 'rgba(249,115,22,0.07)',
                    borderColor: 'rgba(249,115,22,0.22)',
                    color: 'rgba(253,186,116,0.9)',
                  } : cyan && !isActive ? {
                    background: 'rgba(6,182,212,0.07)',
                    borderColor: 'rgba(6,182,212,0.22)',
                    color: 'rgba(103,232,249,0.9)',
                  } : glow && !isActive ? {
                    background: 'rgba(124,58,237,0.08)',
                    borderColor: 'rgba(124,58,237,0.25)',
                    color: 'rgba(167,139,250,0.9)',
                  } : voice && !isActive ? {
                    background: 'rgba(52,211,153,0.06)',
                    borderColor: 'rgba(52,211,153,0.2)',
                    color: 'rgba(52,211,153,0.85)',
                  } : undefined}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {!collapsed && <span>{label}</span>}
                  {!collapsed && orange && !isActive && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(249,115,22,0.15)', color: '#fdba74' }}>
                      NEW
                    </span>
                  )}
                  {!collapsed && cyan && !isActive && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9' }}>
                      NEW
                    </span>
                  )}
                  {!collapsed && glow && !isActive && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
                      AI
                    </span>
                  )}
                  {!collapsed && voice && !isActive && (
                    <div className="ml-auto w-2 h-2 rounded-full status-pulse" style={{ background: '#34d399' }} />
                  )}
                  {!collapsed && isActive && (
                    <div className="ml-auto w-1 h-1 rounded-full" style={{ background: 'rgb(167,139,250)' }} />
                  )}
                  {!collapsed && hasApiAlert && !isActive && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(248,113,133,0.2)', color: '#f87171' }}
                      title={`API issues: ${apiIssues.join(', ')}`}>
                      !
                    </span>
                  )}
                  {collapsed && hasApiAlert && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} />
                  )}
                </Link>
              )
            })}

          </div>
        ))}
      </nav>

      {/* ── Bottom ───────────────────────────────── */}
      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {/* Time today + agent activity */}
        {!collapsed && (
          <div className="mb-2 space-y-1.5">
            <div className="px-3 py-2.5 rounded-lg flex items-center justify-between"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <div className="flex items-center gap-2">
                <Clock size={11} style={{ color: 'rgb(167,139,250)' }} />
                <span className="text-[11px]" style={{ color: 'rgb(130,130,160)' }}>Today</span>
              </div>
              <span className="text-[12px] font-semibold" style={{ color: 'rgb(167,139,250)' }}>
                {fmtSecs(todayTime)}
              </span>
            </div>
            <div className="px-3 py-2.5 rounded-lg flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Activity size={11} style={{ color: 'rgb(167,139,250)' }} />
              <span className="text-[11px]" style={{ color: 'rgb(130,130,160)' }}>Running daily discovery cron</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('btn btn-ghost w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          style={{ padding: '8px 10px', fontSize: '12px', gap: '8px' }}
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
