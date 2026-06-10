import { Sidebar } from '@/components/sidebar'
import AgentActivityLog from '@/components/AgentActivityLog'
import FollowUpNotifications from '@/components/FollowUpNotifications'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'rgb(10, 11, 16)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top status banner — like Pocket Dashboard */}
        <div className="top-banner flex-shrink-0">
          <span style={{ color: 'rgb(167,139,250)', fontWeight: 600 }}>Kima BD OS</span>
          <span className="mx-2 opacity-30">·</span>
          <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ background: 'rgb(52,211,153)', verticalAlign: 'middle' }} />
          <span style={{ color: 'rgb(52,211,153)', fontWeight: 600 }}>Live</span>
          <span className="mx-2 opacity-30">·</span>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span className="mx-2 opacity-30">·</span>
          <span>Powered by GPT-4o + Tavily + Hunter.io</span>
        </div>
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
      <AgentActivityLog />
      <FollowUpNotifications />
    </div>
  )
}
