'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ChevronRight, Lock } from 'lucide-react'

export default function LoginPage() {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode === 'Jarvis007') {
      setLoading(true)
      document.cookie = 'kima_bd_passcode=Jarvis007; path=/; max-age=31536000'
      router.push('/dashboard')
    } else {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(10, 11, 16)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background ambient glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, rgba(10,11,16,0) 70%)', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 10, animation: 'fade-in 0.5s ease-out' }}>
        
        {/* Logo/Icon Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 20px rgba(167,139,250,0.1)' }}>
            <Shield size={22} style={{ color: '#a78bfa' }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>Kima BD OS</h1>
          <p style={{ fontSize: 13, color: 'rgb(120,127,160)', margin: 0, fontWeight: 500 }}>Private AI Operating System</p>
        </div>

        {/* Auth Card */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '28px 24px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <Lock size={15} style={{ color: error ? '#f87171' : 'rgb(100,107,140)' }} />
              </div>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode…"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${error ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10,
                  padding: '12px 14px 12px 40px',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxShadow: error ? '0 0 0 1px rgba(248,113,113,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.2)',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.border = '1px solid rgba(167,139,250,0.4)'
                  if (!error) e.target.style.boxShadow = '0 0 0 1px rgba(167,139,250,0.1), inset 0 2px 4px rgba(0,0,0,0.2)'
                }}
                onBlur={(e) => {
                  if (!error) e.target.style.border = '1px solid rgba(255,255,255,0.1)'
                  if (!error) e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)'
                }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!passcode || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                background: loading ? 'rgba(167,139,250,0.5)' : '#a78bfa',
                color: '#161622',
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                cursor: !passcode || loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: !passcode ? 0.5 : 1,
                boxShadow: '0 4px 12px rgba(167,139,250,0.2)',
              }}
              onMouseEnter={(e) => {
                if (passcode && !loading) e.currentTarget.style.transform = 'translateY(-1px)'
                if (passcode && !loading) e.currentTarget.style.boxShadow = '0 6px 16px rgba(167,139,250,0.3)'
              }}
              onMouseLeave={(e) => {
                if (passcode && !loading) e.currentTarget.style.transform = 'none'
                if (passcode && !loading) e.currentTarget.style.boxShadow = '0 4px 12px rgba(167,139,250,0.2)'
              }}
            >
              {loading ? 'Authenticating…' : 'Access System'}
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 11, color: 'rgb(80,87,120)', margin: 0 }}>
            Restricted Access. Authorized personnel only.
          </p>
        </div>
      </div>
    </div>
  )
}
