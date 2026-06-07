'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode === 'Jarvis007') {
      // Set a cookie that the middleware will check
      document.cookie = 'kima_bd_passcode=Jarvis007; path=/; max-age=31536000' // 1 year expiry
      router.push('/dashboard')
    } else {
      setError(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b10]">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-[#161622] border border-white/10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
            <Lock className="text-violet-400" size={24} />
          </div>
        </div>
        
        <h1 className="text-xl font-bold text-center text-white mb-2">Kima BD OS</h1>
        <p className="text-sm text-center text-zinc-400 mb-8">Enter your passcode to access the agent.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value)
                setError(false)
              }}
              placeholder="Passcode"
              className="w-full bg-[#1e1e2d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
              autoFocus
            />
            {error && <p className="text-rose-400 text-xs mt-2 text-center">Incorrect passcode</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl px-4 py-3 transition-colors flex justify-center items-center h-[46px]"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
