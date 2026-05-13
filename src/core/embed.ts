// ============================================================
//  TEO — src/memory/embed.ts
//  Serviço de embeddings semânticos via nomic-embed-text
//
//  Responsabilidades:
//    - Gerar vetores numéricos para textos (mensagens, inputs)
//    - Busca semântica por similaridade de cosseno
//    - Indexar mensagens do chatCache que ainda não têm embed
//    - Preview compacto para exibição em logs
//
//  Modelo: TEO.embedModelo (nomic-embed-text:latest)
//  Dimensões: 768 por padrão no nomic-embed-text
// ============================================================

import { OllamaEmbeddings } from '@langchain/ollama'
import { TEO } from '../aios'
import { cacheGet, cacheSet } from './embedCache'
import type { OpenAIMessage } from './types'

// ── Instância única do embedder ──────────────────────────────

const embedder = new OllamaEmbeddings({
  baseUrl: TEO.ollamaUrl,
  model: TEO.embedModelo,
})

// ── Geração com cache ──────────────────────────────────────

export async function embedTexto(
  texto: string
): Promise<number[]> {
  const cached = cacheGet(texto)
  if (cached) return cached

  try {
    const embed = await embedder.embedQuery(texto)
    cacheSet(texto, embed)
    return embed
  } catch {
    return []
  }
}

export async function embedLote(
  textos: string[]
): Promise<number[][]> {
  // Filtra textos já em cache
  const resultados: number[][] = []
  const aBuscar: { index: number; texto: string }[] = []

  for (let i = 0; i < textos.length; i++) {
    const texto = textos[i]
    if (!texto) continue
    const cached = cacheGet(texto)
    if (cached) {
      resultados[i] = cached
    } else {
      aBuscar.push({ index: i, texto })
    }
  }

  if (aBuscar.length === 0) return resultados

  try {
    const textosParaBuscar = aBuscar.map((x) => x.texto)
    const vetores = await embedder.embedDocuments(
      textosParaBuscar
    )

    for (let i = 0; i < aBuscar.length; i++) {
      const entry = aBuscar[i]
      if (!entry) continue
      const { index, texto } = entry
      const embed = vetores[i] ?? []
      cacheSet(texto, embed)
      resultados[index] = embed
    }
  } catch {
    for (const { index } of aBuscar) {
      resultados[index] = []
    }
  }

  // Preenche buracos com arrays vazios
  for (let i = 0; i < textos.length; i++) {
    if (!resultados[i]) resultados[i] = []
  }

  return resultados
}

// ── Similaridade de cosseno ───────────────────────────────────

export function cosineSim(
  a: number[],
  b: number[]
): number {
  if (!a.length || a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0)
    normA += (a[i] ?? 0) ** 2
    normB += (b[i] ?? 0) ** 2
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ── Busca semântica ───────────────────────────────────────────
// Retorna as topK mensagens mais similares à queryEmbed,
// preservando a ordem cronológica original no resultado.

export function buscarMensagensSimilares(
  queryEmbed: number[],
  mensagens: OpenAIMessage[],
  topK: number
): OpenAIMessage[] {
  if (!queryEmbed.length || !mensagens.length) return []

  const comScore = mensagens
    .map((m, idx) => ({
      idx,
      msg: m,
      score: m.embed?.length
        ? cosineSim(queryEmbed, m.embed)
        : -1,
    }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.idx - b.idx) // restaura ordem cronológica

  return comScore.map((x) => x.msg)
}

// ── Indexação de mensagens sem embed ─────────────────────────
// Só gera embed para mensagens que ainda não têm um.
// Usa embedLote para eficiência.

export async function indexarMensagens(
  mensagens: OpenAIMessage[]
): Promise<OpenAIMessage[]> {
  const semEmbed = mensagens
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !m.embed?.length)

  if (!semEmbed.length) return mensagens

  const textos = semEmbed.map(({ m }) => m.content)
  const vetores = await embedLote(textos)

  const resultado = [...mensagens]
  semEmbed.forEach(({ i }, pos) => {
    const msg = resultado[i]
    if (msg) {
      resultado[i] = { ...msg, embed: vetores[pos] ?? [] }
    }
  })

  return resultado
}

// ── Preview compacto para logs ────────────────────────────────
// Mostra os 6 primeiros valores e a dimensionalidade.

export function embedPreview(embed: number[]): string {
  if (!embed?.length) return 'não gerado'
  const vals = embed
    .slice(0, 6)
    .map((n) => n.toFixed(4))
    .join(', ')
  return `[${vals}, ...] (${embed.length}d)`
}
