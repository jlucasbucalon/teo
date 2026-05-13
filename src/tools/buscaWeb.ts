// ============================================================
//  TEO — src/tools/buscaWeb.ts
//  Busca na web via Ollama Cloud API
//
//  Regra simples e previsível:
//    rapido   → não busca (foco em velocidade)
//    profundo → sempre busca (análises completas)
//
//  Melhorias sobre a versão anterior:
//    - Cache de buscas com TTL de 10 minutos
//    - Query otimizada automaticamente (remove ruído)
//    - Filtro de resultados por conteúdo mínimo
//    - Deduplicação por domínio
//    - Nunca lança exceção — sempre retorna RespostaBusca
// ============================================================

import axios from 'axios'
import { TEO } from '../aios'
import type { ModoRaciocinio } from '../core/reasoning'

// ── Configuração ─────────────────────────────────────────────

const BUSCA_URL = 'https://ollama.com/api/web_search'
const TIMEOUT_MS = 10_000
const CACHE_TTL = 10 * 60 * 1000 // 10 minutos
const CONTEUDO_MINIMO = 50 // chars mínimos por resultado

// ── Decisão de busca ─────────────────────────────────────────
// Regra única: só o modo decide.
//   rapido   → não busca
//   profundo → sempre busca

export interface DecisaoBusca {
  buscar: boolean
  maxResultados: number
}

export function decidirBusca(
  modo: ModoRaciocinio
): DecisaoBusca {
  if (modo === 'local') {
    return { buscar: false, maxResultados: 0 }
  }
  // profundo — sempre busca
  return { buscar: true, maxResultados: 5 }
}

// ── Cache de buscas ───────────────────────────────────────────

interface EntradaCache {
  resposta: RespostaBusca
  expiraEm: number
}

const _cache = new Map<string, EntradaCache>()

function chaveCache(query: string, max: number): string {
  return `${query.toLowerCase().trim()}::${max}`
}

function lerCache(
  query: string,
  max: number
): RespostaBusca | null {
  const entrada = _cache.get(chaveCache(query, max))
  if (!entrada) return null
  if (Date.now() > entrada.expiraEm) {
    _cache.delete(chaveCache(query, max))
    return null
  }
  return entrada.resposta
}

function salvarCache(
  query: string,
  max: number,
  resposta: RespostaBusca
): void {
  _cache.set(chaveCache(query, max), {
    resposta,
    expiraEm: Date.now() + CACHE_TTL,
  })
}

// ── Otimização de query ───────────────────────────────────────

const STOP_WORDS = new Set([
  'oque',
  'qual',
  'quais',
  'como',
  'quando',
  'onde',
  'porque',
  'quem',
  'quanto',
  'me',
  'meu',
  'minha',
  'você',
  'teo',
  'eu',
  'gostaria',
  'preciso',
  'quero',
  'pode',
  'poderia',
  'explica',
  'explique',
  'fala',
  'conta',
  'diz',
  'é',
  'de',
  'da',
  'do',
  'em',
  'um',
  'uma',
  'os',
  'as',
  'para',
  'com',
  'por',
  'se',
  'na',
  'no',
  'que',
  'e',
  'a',
  'o',
  'i',
  'u',
  'ou',
])

/**
 * Otimiza a query antes de enviar para a API:
 * - Remove prefixo "teo" e pontuação
 * - Remove stop words
 * - Adiciona ano atual para nichos técnicos
 * - Limita tamanho a 100 chars
 */
export function otimizarQuery(
  query: string,
  nicho?: string
): string {
  const anoAtual = new Date().getFullYear()

  let q = query
    .replace(/^teo[,\s]*/i, '')
    .replace(/[?!]/g, '')
    .trim()

  const palavras = q
    .split(/\s+/)
    .filter(
      (p) =>
        p.length > 2 && !STOP_WORDS.has(p.toLowerCase())
    )

  q = palavras.join(' ')

  // Adiciona ano para nichos técnicos (programação, ciência, etc.)
  const nichosComAno = [
    'programacao',
    'ciencia',
    'tecnologia',
  ]
  if (
    nicho &&
    nichosComAno.includes(nicho) &&
    !q.includes(String(anoAtual))
  ) {
    q = `${q} ${anoAtual}`
  }

  return q.slice(0, 100).trim()
}

// ── Filtragem de resultados ───────────────────────────────────

function extrairDominio(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

/**
 * Filtra resultados com conteúdo mínimo e deduplica por domínio.
 */
function filtrarResultados(
  resultados: ResultadoBusca[],
  max: number
): ResultadoBusca[] {
  const dominiosVistos = new Set<string>()

  return resultados
    .filter((r) => {
      if (!r.title || !r.url) return false
      if (
        !r.content ||
        r.content.trim().length < CONTEUDO_MINIMO
      )
        return false
      return true
    })
    .filter((r) => {
      const dominio = extrairDominio(r.url)
      if (dominiosVistos.has(dominio)) return false
      dominiosVistos.add(dominio)
      return true
    })
    .slice(0, max)
}

// ── Tipos ─────────────────────────────────────────────────────

export interface ResultadoBusca {
  title: string
  url: string
  content: string
}

export interface RespostaBusca {
  resultados: ResultadoBusca[]
  query: string
  queryUsada: string // query após otimização — útil para debug
  cached: boolean // veio do cache?
  erro?: string
}

// ── Busca principal ───────────────────────────────────────────

export async function buscaWeb(
  query: string,
  maxResultados = 5,
  nicho?: string
): Promise<RespostaBusca> {
  if (!TEO.ollamaApiKey) {
    return {
      resultados: [],
      query,
      queryUsada: query,
      cached: false,
      erro: 'OLLAMA_API_KEY não configurada',
    }
  }

  // Otimiza a query antes de buscar
  const queryUsada = otimizarQuery(query, nicho)

  // Verifica cache — mesma query não faz duas requisições em 10 min
  const cached = lerCache(queryUsada, maxResultados)
  if (cached) {
    return { ...cached, cached: true }
  }

  try {
    // Pede um pouco mais para ter margem após filtragem
    const response = await axios.post(
      BUSCA_URL,
      { query: queryUsada, max_results: maxResultados + 2 },
      {
        headers: {
          Authorization: `Bearer ${TEO.ollamaApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_MS,
      }
    )

    const brutos: ResultadoBusca[] = (
      response.data?.results ?? []
    ).map(
      (r: {
        title?: string
        url?: string
        content?: string
      }) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
      })
    )

    const resultados = filtrarResultados(
      brutos,
      maxResultados
    )

    const resposta: RespostaBusca = {
      resultados,
      query,
      queryUsada,
      cached: false,
    }

    salvarCache(queryUsada, maxResultados, resposta)
    return resposta
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Erro desconhecido'
    return {
      resultados: [],
      query,
      queryUsada,
      cached: false,
      erro: msg,
    }
  }
}

/**
 * Limpa o cache de buscas manualmente.
 */
export function limparCacheBusca(): void {
  _cache.clear()
}
