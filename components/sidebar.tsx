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
        'flex flex-col h-screen sticky top-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex-shrink-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
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
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--text-primary)] shadow-[0_0_20px_rgba(255,255,255,0.15)]">
          <Briefcase size={16} strokeWidth={2} color="var(--bg-primary)" />
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
              <div className="text-eyebrow px-4 mb-2 mt-4 text-[var(--text-muted)]">
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
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]',
                    isActive 
                      ? 'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                      : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]',
                    collapsed && 'justify-center px-0 py-3 mx-2'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} strokeWidth={1.5} className={cn("flex-shrink-0 transition-transform duration-300", isActive ? "text-[var(--text-primary)] scale-110" : "text-[var(--text-muted)] group-hover:scale-110")} />
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
            'flex items-center w-full rounded-xl text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]',
            collapsed ? 'justify-center p-3' : 'px-4 py-3 gap-2'
          )}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={1.5} /> : <><ChevronLeft size={16} strokeWidth={1.5} /><span className="truncate">Collapse Menu</span></>}
        </button>
      </div>
    </aside>
  )
}
