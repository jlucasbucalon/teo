// ============================================================
//  TEO — src/tools/lerVector.ts
//  Leitura dos .md dos nichos com busca semântica por seção.
//
//  Responsabilidade única: LER e CONSULTAR.
//  Escrita é responsabilidade exclusiva de escreverVector.ts.
//
//  Funcionalidades:
//    - Cache com TTL de 5 minutos
//    - Detecção de conteúdo real vs template vazio
//    - Timestamp real via fs.stat
//    - lerContexto()       → .md completo (para trainer)
//    - lerContextoFocado() → só seções relevantes (para agentes)
//    - Cache de embeddings por seção — recalcula só quando .md muda
//    - invalidarCache() para escreverVector.ts usar após escrita
//    - Nunca lança exceção
// ============================================================

import fs from 'fs'
import path from 'path'
import {
  embedTexto,
  embedLote,
  cosineSim,
} from '../core/embed'

// ── Configuração ─────────────────────────────────────────────

const TRAINER_DIR = path.resolve(
  __dirname,
  '../../src/memory/trainer/nichos'
)

const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Pontuação mínima de similaridade para incluir uma seção
const SCORE_MINIMO = 0.3

// Marcadores de template vazio — arquivo sem conhecimento real
const MARCADORES_VAZIO = [
  '_sem dados ainda_',
  'sem dados ainda',
  'última atualização: —',
]

if (!fs.existsSync(TRAINER_DIR)) {
  fs.mkdirSync(TRAINER_DIR, { recursive: true })
}

// ── Tipos ────────────────────────────────────────────────────

export interface ConteudoNicho {
  nicho: string
  conteudo: string
  tamanho: number
  atualizadoEm: string // timestamp real de modificação (fs.stat)
  existe: boolean
  temConhecimento: boolean // true se tem conteúdo além do template
  contexto: string // .md completo formatado para injeção
}

interface Secao {
  titulo: string // texto do header ##
  corpo: string // conteúdo da seção
  texto: string // titulo + corpo (para embed)
  embed: number[] // vetor semântico da seção
}

interface CacheNicho {
  conteudo: ConteudoNicho
  secoes: Secao[] // seções com embeddings
  expiraEm: number
  mtime: number // mtime do arquivo quando foi cacheado
}

const _cache = new Map<string, CacheNicho>()

// ── Helpers ───────────────────────────────────────────────────

function detectarConhecimentoReal(
  conteudo: string
): boolean {
  if (!conteudo.trim()) return false

  const linhasSignificativas = conteudo
    .split('\n')
    .filter((linha) => {
      const l = linha.trim()
      if (!l) return false
      if (l.startsWith('#')) return false
      if (l.startsWith('_') && l.endsWith('_')) return false
      if (MARCADORES_VAZIO.some((m) => l.includes(m)))
        return false
      return true
    })

  return linhasSignificativas.length >= 3
}

function obterMtime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return 0
  }
}

function obterDataModificacao(file: string): string {
  try {
    return fs.statSync(file).mtime.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * Divide o .md em seções pelo header ##
 * Cada seção = título + corpo
 */
function dividirEmSecoes(
  conteudo: string
): Omit<Secao, 'embed'>[] {
  const linhas = conteudo.split('\n')
  const secoes: Omit<Secao, 'embed'>[] = []
  let tituloAtual = ''
  let corpoAtual: string[] = []

  for (const linha of linhas) {
    if (linha.startsWith('## ')) {
      // Salva seção anterior se tiver corpo
      if (tituloAtual && corpoAtual.join('').trim()) {
        const corpo = corpoAtual.join('\n').trim()
        secoes.push({
          titulo: tituloAtual,
          corpo,
          texto: `${tituloAtual}\n${corpo}`,
        })
      }
      tituloAtual = linha.replace('## ', '').trim()
      corpoAtual = []
    } else if (tituloAtual) {
      corpoAtual.push(linha)
    }
  }

  // Última seção
  if (tituloAtual && corpoAtual.join('').trim()) {
    const corpo = corpoAtual.join('\n').trim()
    secoes.push({
      titulo: tituloAtual,
      corpo,
      texto: `${tituloAtual}\n${corpo}`,
    })
  }

  return secoes
}

/**
 * Filtra seções que têm conteúdo real (ignora seções vazias/template)
 */
function secoesSomentePleenas(
  secoes: Omit<Secao, 'embed'>[]
): Omit<Secao, 'embed'>[] {
  return secoes.filter((s) => {
    const corpo = s.corpo.trim()
    if (!corpo) return false
    if (MARCADORES_VAZIO.some((m) => corpo.includes(m)))
      return false
    return corpo.length > 20
  })
}

/**
 * Gera embeddings para todas as seções em lote
 */
async function embedarSecoes(
  secoes: Omit<Secao, 'embed'>[]
): Promise<Secao[]> {
  if (!secoes.length) return []

  const textos = secoes.map((s) => s.texto)
  const vetores = await embedLote(textos).catch(() =>
    secoes.map(() => [] as number[])
  )

  return secoes.map((s, i) => ({
    ...s,
    embed: vetores[i] ?? [],
  }))
}

/**
 * Monta contexto focado a partir das seções mais relevantes
 */
function montarContextoFocado(
  nicho: string,
  secoes: Secao[],
  topK: number
): string {
  if (!secoes.length) return ''

  const partes = [
    `## Conhecimento acumulado — ${nicho} (seções mais relevantes)`,
    ...secoes
      .slice(0, topK)
      .map((s) => `### ${s.titulo}\n${s.corpo}`),
  ]

  return partes.join('\n\n')
}

// ── Cache e leitura ───────────────────────────────────────────

/**
 * Garante que o cache está válido para o nicho.
 * Recalcula se: TTL expirou OU arquivo foi modificado desde o cache.
 */
async function garantirCache(
  nicho: string
): Promise<CacheNicho | null> {
  const file = path.join(TRAINER_DIR, `${nicho}.md`)
  const mtime = obterMtime(file)
  const agora = Date.now()

  const cached = _cache.get(nicho)

  // Cache válido: TTL ok E arquivo não mudou
  if (
    cached &&
    agora < cached.expiraEm &&
    cached.mtime === mtime
  ) {
    return cached
  }

  // Arquivo não existe
  if (!fs.existsSync(file)) {
    const entry: ConteudoNicho = {
      nicho,
      conteudo: '',
      tamanho: 0,
      atualizadoEm: new Date().toISOString(),
      existe: false,
      temConhecimento: false,
      contexto: '',
    }
    const cacheEntry: CacheNicho = {
      conteudo: entry,
      secoes: [],
      expiraEm: agora + CACHE_TTL,
      mtime: 0,
    }
    _cache.set(nicho, cacheEntry)
    return cacheEntry
  }

  // Lê e processa o arquivo
  try {
    const conteudo = fs.readFileSync(file, 'utf8')
    const temConhecimento =
      detectarConhecimentoReal(conteudo)
    const atualizadoEm = obterDataModificacao(file)

    // Divide em seções e embeda as que têm conteúdo real
    const secoesRaw = dividirEmSecoes(conteudo)
    const secoesPleenas = secoesSomentePleenas(secoesRaw)
    const secoes = temConhecimento
      ? await embedarSecoes(secoesPleenas)
      : []

    const contexto = temConhecimento
      ? `## Conhecimento acumulado — ${nicho}\n${conteudo.trim()}`
      : ''

    const entry: ConteudoNicho = {
      nicho,
      conteudo,
      tamanho: conteudo.length,
      atualizadoEm,
      existe: true,
      temConhecimento,
      contexto,
    }

    const cacheEntry: CacheNicho = {
      conteudo: entry,
      secoes,
      expiraEm: agora + CACHE_TTL,
      mtime,
    }

    _cache.set(nicho, cacheEntry)
    return cacheEntry
  } catch {
    return null
  }
}

// ── API pública ───────────────────────────────────────────────

/**
 * Lê os metadados e conteúdo do nicho.
 * Para o agente saber se vale injetar o contexto.
 */
export async function lerNicho(
  nicho: string
): Promise<ConteudoNicho> {
  const cache = await garantirCache(nicho)

  if (!cache) {
    return {
      nicho,
      conteudo: '',
      tamanho: 0,
      atualizadoEm: new Date().toISOString(),
      existe: false,
      temConhecimento: false,
      contexto: '',
    }
  }

  return cache.conteudo
}

/**
 * Retorna o .md completo formatado.
 * Usado pelo agenteTrainer — ele precisa de tudo para avaliar.
 */
export async function lerContexto(
  nicho: string
): Promise<string> {
  const n = await lerNicho(nicho)
  return n.contexto
}

/**
 * Retorna APENAS as seções do .md mais relevantes para o input.
 * Usado pelos agentes de resposta — contexto focado, sem ruído.
 *
 * Algoritmo:
 *   1. Embeda o input do usuário
 *   2. Compara com embeddings de cada seção do .md
 *   3. Retorna as topK seções acima do score mínimo
 *   4. Monta contexto formatado pronto para injetar no prompt
 *
 * @param nicho   ID do nicho (ex: "programacao")
 * @param input   Pergunta do usuário (para calcular similaridade)
 * @param topK    Máximo de seções a retornar (padrão: 3)
 * @returns       String pronta para injetar no system prompt
 */
export async function lerContextoFocado(
  nicho: string,
  input: string,
  topK = 3
): Promise<string> {
  const cache = await garantirCache(nicho)

  if (!cache || !cache.conteudo.temConhecimento) return ''
  if (!cache.secoes.length) return ''

  // Embeda o input do usuário
  const inputEmbed = await embedTexto(input).catch(
    () => [] as number[]
  )
  if (!inputEmbed.length) {
    // Fallback: retorna .md completo se não conseguir embeding
    return cache.conteudo.contexto
  }

  // Calcula similaridade de cosseno para cada seção
  const secoesComScore = cache.secoes
    .map((secao) => ({
      secao,
      score: secao.embed.length
        ? cosineSim(inputEmbed, secao.embed)
        : 0,
    }))
    .filter((x) => x.score >= SCORE_MINIMO)
    .sort((a, b) => b.score - a.score)

  if (!secoesComScore.length) {
    // Nenhuma seção relevante — retorna contexto completo como fallback
    return cache.conteudo.contexto
  }

  const secoesSelecionadas = secoesComScore
    .slice(0, topK)
    .map((x) => x.secao)

  return montarContextoFocado(
    nicho,
    secoesSelecionadas,
    topK
  )
}

/**
 * Invalida o cache de um nicho.
 * Deve ser chamado pelo escreverVector.ts após qualquer escrita.
 */
export function invalidarCache(nicho: string): void {
  _cache.delete(nicho)
}

/**
 * Lista todos os nichos disponíveis com metadados.
 */
export async function listarNichos(): Promise<
  ConteudoNicho[]
> {
  try {
    const arquivos = fs
      .readdirSync(TRAINER_DIR)
      .filter((f) => f.endsWith('.md'))

    return await Promise.all(
      arquivos.map((arquivo) =>
        lerNicho(arquivo.replace('.md', ''))
      )
    )
  } catch {
    return []
  }
}
