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
  Briefcase
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
        'flex flex-col h-screen sticky top-0 transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 p-5',
        collapsed && 'justify-center p-4'
      )} style={{ height: '72px' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--text-primary)]">
          <Briefcase size={14} color="var(--bg-primary)" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-[var(--text-primary)] font-semibold text-[13px] tracking-tight leading-none whitespace-nowrap">Kima BD OS</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <div className="text-[11px] font-medium px-3 mb-1.5 text-[var(--text-muted)]">
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
                    'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                    isActive 
                      ? 'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)]' 
                      : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]',
                    collapsed && 'justify-center px-0 py-2.5 mx-1'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={16} className={cn("flex-shrink-0", isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-[var(--border-subtle)]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center w-full rounded-md text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)] transition-colors',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2'
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span className="truncate">Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
