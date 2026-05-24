'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
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
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Lead Inbox', icon: Inbox },
  { href: '/sources', label: 'Sources', icon: Database },
  { href: '/outreach', label: 'Outreach Studio', icon: MessageSquare },
  { href: '/agent-rules', label: 'Agent Rules', icon: Settings2 },
  { href: '/feedback', label: 'Feedback Memory', icon: Brain },
  { href: '/reports', label: 'Weekly Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0 transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{
        background: 'rgba(14, 14, 22, 0.95)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 p-5 border-b',
        collapsed && 'justify-center'
      )}
        style={{ borderColor: 'rgba(255,255,255,0.04)', minHeight: '80px' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          <Zap size={16} color="white" fill="white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-sm leading-none whitespace-nowrap">Kima BD OS</div>
            <div className="text-xs whitespace-nowrap" style={{ color: 'rgb(80,80,100)' }}>AI BD Engine</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="text-xs font-semibold mb-3 px-2"
            style={{ color: 'rgb(70, 70, 90)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Navigation
          </div>
        )}
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'nav-item',
                isActive && 'active',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('btn btn-ghost w-full text-xs', collapsed && 'justify-center px-0')}
          style={{ padding: '10px', gap: '8px' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse Sidebar</span></>}
        </button>
      </div>
    </aside>
  )
}
