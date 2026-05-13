// ============================================================
//  TEO — src/core/embedCache.ts
//  Cache em memória para embeddings
//
//  Usa Map com key baseada no hash do texto.
//  TTL de 1 hora para manter cache fresco.
// ============================================================

import crypto from 'crypto'

interface CacheEntry {
  embed: number[]
  timestamp: number
}

const CACHE = new Map<string, CacheEntry>()
const TTL_MS = 60 * 60 * 1000 // 1 hora

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export function cacheGet(text: string): number[] | null {
  const key = hash(text)
  const entry = CACHE.get(key)

  if (!entry) return null

  if (Date.now() - entry.timestamp > TTL_MS) {
    CACHE.delete(key)
    return null
  }

  return entry.embed
}

export function cacheSet(text: string, embed: number[]): void {
  const key = hash(text)
  CACHE.set(key, { embed, timestamp: Date.now() })
}

export function cacheSize(): number {
  return CACHE.size
}

export function cacheClear(): void {
  CACHE.clear()
}