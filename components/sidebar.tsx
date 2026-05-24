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
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Command Center',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    label: 'Lead Operations',
    items: [
      { href: '/leads', label: 'Lead Inbox', icon: Inbox },
      { href: '/sources', label: 'Sources', icon: Database },
      { href: '/outreach', label: 'Outreach Studio', icon: MessageSquare },
    ]
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/agent-rules', label: 'Agent Rules', icon: Settings2 },
      { href: '/feedback', label: 'Feedback Memory', icon: Brain },
      { href: '/reports', label: 'Weekly Reports', icon: BarChart3 },
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ]
  }
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex h-screen flex-shrink-0 flex-col sticky top-0 transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[264px]'
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(26,27,32,0.96), rgba(19,20,24,0.96))',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-5 pb-5 pt-6',
        collapsed && 'justify-center px-3'
      )}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-[0_16px_42px_rgba(0,0,0,0.22)]">
          <Sparkles size={17} />
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <div className="whitespace-nowrap text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Kima BD OS</div>
            <div className="mt-1 truncate text-[12px] text-[var(--text-muted)]">AI business development</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-4">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            {!collapsed && (
              <div className="px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {group.label}
              </div>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all',
                    isActive 
                      ? 'bg-white/[0.065] text-[var(--text-primary)] shadow-[0_10px_30px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.055]' 
                      : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]',
                    collapsed && 'mx-1 justify-center px-0 py-3'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={16} className={cn("flex-shrink-0 transition-colors", isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]")} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border-subtle)] p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex w-full items-center rounded-2xl text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text-primary)]',
            collapsed ? 'justify-center p-3' : 'gap-2 px-3 py-2.5'
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span className="truncate">Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
