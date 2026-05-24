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
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{
        background: 'rgba(11, 11, 16, 0.4)', // Translucent sidebar
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 p-6 border-b',
        collapsed && 'justify-center p-4'
      )}
        style={{ borderColor: '#1A1A24', minHeight: '80px' }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
        >
          <Zap size={16} color="white" fill="white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-[#F4F4F5] font-bold text-sm tracking-wide leading-none whitespace-nowrap">Kima BD OS</div>
            <div className="text-[#71717A] text-[11px] font-medium mt-1 whitespace-nowrap tracking-wider uppercase">Business Engine</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1.5">
            {!collapsed && (
              <div className="text-[11px] font-bold px-3 mb-2"
                style={{ color: '#52525B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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
                    'nav-item',
                    isActive && 'active',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={16} className={cn("flex-shrink-0", isActive ? "text-[#8B5CF6]" : "text-[#71717A]")} />
                  {!collapsed && <span className={cn("font-medium", isActive ? "text-[#F4F4F5]" : "text-[#A1A1AA]")}>{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t" style={{ borderColor: '#1A1A24' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('btn btn-ghost w-full text-xs justify-start', collapsed && 'justify-center px-0')}
          style={{ padding: '10px 14px', gap: '10px' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="text-[#A1A1AA] font-medium">Collapse Sidebar</span></>}
        </button>
      </div>
    </aside>
  )
}
