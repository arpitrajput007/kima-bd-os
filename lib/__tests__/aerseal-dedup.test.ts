// ============================================================================
// Dedup building blocks used by discover-aerseal's insert path
// (app/api/ai/discover-aerseal/route.ts, "Dedupe against leads already in the
// box"): domain normalization (toDomain) and the generic-name gate
// (isGenericName) that keeps category labels like "DeFi protocols" from ever
// reaching the dossier stage. Both are pure functions, so they're covered
// directly rather than through the route (which needs a live DB + LLM).
// ============================================================================

import { describe, it, expect } from 'vitest'
import { toDomain } from '@/lib/apollo'
import { isGenericName } from '@/lib/leadQuality'

describe('toDomain — dedup key normalization', () => {
  it('strips protocol, www, and path', () => {
    expect(toDomain('https://www.Example-Protocol.xyz/docs/security')).toBe('example-protocol.xyz')
    expect(toDomain('http://example-protocol.xyz')).toBe('example-protocol.xyz')
  })

  it('treats differently-cased/formatted URLs for the same org as the same domain', () => {
    const a = toDomain('https://Example-Protocol.xyz')
    const b = toDomain('https://www.example-protocol.xyz/')
    expect(a).toBe(b)
  })

  it('returns an empty string for a missing website', () => {
    expect(toDomain(undefined)).toBe('')
    expect(toDomain('')).toBe('')
  })
})

describe('isGenericName — category-label gate', () => {
  it('rejects bare sector/category words', () => {
    expect(isGenericName('DeFi')).toBe(true)
    expect(isGenericName('Infrastructure')).toBe(true)
    expect(isGenericName('Stablecoins')).toBe(true)
  })

  it('rejects multi-word category phrases', () => {
    expect(isGenericName('Cross-border Payment Providers')).toBe(true)
    expect(isGenericName('DeFi Protocols')).toBe(true)
  })

  it('accepts real, specific organisation names', () => {
    expect(isGenericName('Aurora Lending DAO')).toBe(false)
    expect(isGenericName('Meridian Vault')).toBe(false)
    expect(isGenericName('Solstice Bridge')).toBe(false)
  })

  it('rejects empty or single-character input', () => {
    expect(isGenericName('')).toBe(true)
    expect(isGenericName('X')).toBe(true)
  })
})
