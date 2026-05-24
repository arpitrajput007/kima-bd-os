'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, Save, X, Power, PowerOff } from 'lucide-react'
import { cn, getRuleTypeColor, getRuleTypeLabel } from '@/lib/utils'
import type { AgentRule } from '@/lib/types'

const RULE_TYPES = ['prioritize', 'reject', 'score_boost', 'score_penalty', 'outreach_style', 'source_preference']

const emptyForm: Partial<AgentRule> = {
  rule_type: 'prioritize', rule: '', weight: 0, status: 'active'
}

export default function AgentRulesPage() {
  const supabase = createClient()
  const [rules, setRules] = useState<AgentRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<AgentRule>>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const loadRules = async () => {
    setLoading(true)
    const { data } = await supabase.from('agent_rules').select('*').order('rule_type').order('weight', { ascending: false })
    setRules(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRules() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.rule) { toast.error('Rule text required'); return }
    setSaving(true)

    const payload = { rule_type: form.rule_type, rule: form.rule, weight: form.weight || 0, status: form.status || 'active' }

    let error
    if (editId) {
      ({ error } = await supabase.from('agent_rules').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId))
    } else {
      ({ error } = await supabase.from('agent_rules').insert(payload))
    }

    if (error) toast.error('Failed to save')
    else { toast.success(editId ? 'Rule updated' : 'Rule added'); setShowForm(false); setEditId(null); setForm(emptyForm); loadRules() }
    setSaving(false)
  }

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return
    await supabase.from('agent_rules').delete().eq('id', id)
    toast.success('Rule deleted')
    loadRules()
  }

  const toggleStatus = async (rule: AgentRule) => {
    const newStatus = rule.status === 'active' ? 'inactive' : 'active'
    await supabase.from('agent_rules').update({ status: newStatus }).eq('id', rule.id)
    loadRules()
  }

  const startEdit = (rule: AgentRule) => {
    setForm(rule)
    setEditId(rule.id)
    setShowForm(true)
  }

  const filtered = rules.filter(r => !filter || r.rule_type === filter)

  const grouped = RULE_TYPES.reduce((acc, type) => {
    const group = filtered.filter(r => r.rule_type === type)
    if (group.length) acc[type] = group
    return acc
  }, {} as Record<string, AgentRule[]>)

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agent Rules</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            {rules.filter(r => r.status === 'active').length} active rules · Control how the agent scores and prioritizes leads
          </p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(!showForm) }}
          className="btn btn-primary" style={{ fontSize: '13px' }}>
          <Plus size={14} />Add Rule
        </button>
      </div>

      <div className="p-8 space-y-6">
        {/* Add/Edit Form */}
        {showForm && (
          <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.9)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <h2 className="text-sm font-semibold text-white mb-4">{editId ? 'Edit Rule' : 'Add New Rule'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Rule Type</label>
                  <select className="input-dark" value={form.rule_type || 'prioritize'} onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as AgentRule['rule_type'] }))}>
                    {RULE_TYPES.map(t => <option key={t} value={t}>{getRuleTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Weight (+ boost / - penalty)</label>
                  <input className="input-dark" type="number" min="-50" max="50" value={form.weight || 0} onChange={e => setForm(f => ({ ...f, weight: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Status</label>
                  <select className="input-dark" value={form.status || 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value as AgentRule['status'] }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Rule Text *</label>
                  <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={form.rule || ''} onChange={e => setForm(f => ({ ...f, rule: e.target.value }))} placeholder="Describe the rule clearly..." required />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {editId ? 'Update' : 'Add Rule'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }} className="btn btn-ghost" style={{ fontSize: '12px' }}>
                  <X size={13} />Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('')}
            className={cn('badge cursor-pointer', !filter ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'bg-white/5 text-zinc-400 border-white/10')}
            style={{ padding: '5px 10px', fontSize: '12px' }}>
            All ({rules.length})
          </button>
          {RULE_TYPES.map(t => {
            const count = rules.filter(r => r.rule_type === t).length
            if (!count) return null
            return (
              <button key={t} onClick={() => setFilter(t === filter ? '' : t)}
                className={cn('badge cursor-pointer', filter === t ? `${getRuleTypeColor(t)} opacity-100` : 'bg-white/5 text-zinc-400 border-white/10')}
                style={{ padding: '5px 10px', fontSize: '12px' }}>
                {getRuleTypeLabel(t)} ({count})
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([type, typeRules]) => (
              <div key={type} className="rounded-xl overflow-hidden" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  <span className={cn('badge', getRuleTypeColor(type))} style={{ fontSize: '11px' }}>
                    {getRuleTypeLabel(type)}
                  </span>
                  <span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>{typeRules.length} rules</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {typeRules.map(rule => (
                    <div key={rule.id} className={cn('flex items-start justify-between p-4 gap-4', rule.status === 'inactive' && 'opacity-50')}>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed" style={{ color: 'rgb(210,210,230)' }}>{rule.rule}</p>
                        {rule.weight !== 0 && (
                          <span className={cn('badge mt-2 text-xs', rule.weight > 0
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30')}
                            style={{ fontSize: '10px' }}>
                            {rule.weight > 0 ? '+' : ''}{rule.weight} pts
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => toggleStatus(rule)} className="btn btn-ghost" style={{ padding: '4px', color: rule.status === 'active' ? '#34d399' : 'rgb(100,100,120)' }}
                          title={rule.status === 'active' ? 'Deactivate' : 'Activate'}>
                          {rule.status === 'active' ? <Power size={13} /> : <PowerOff size={13} />}
                        </button>
                        <button onClick={() => startEdit(rule)} className="btn btn-ghost" style={{ padding: '4px' }}>
                          <Edit size={13} />
                        </button>
                        <button onClick={() => deleteRule(rule.id)} className="btn btn-ghost" style={{ padding: '4px', color: '#f87171' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
