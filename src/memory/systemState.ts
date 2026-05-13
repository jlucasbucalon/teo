// ============================================================
//  TEO — src/memory/systemState.ts
//  Estado operacional do Sistema Operacional de IAs
//  TEO atualiza em tempo real — uptime, processos, métricas
// ============================================================

import * as fs from 'fs'
import * as path from 'path'

export interface SystemState {
  uptime: string
  uptimeMs: number
  processos: ProcessInfo[]
  memoria: MemoriaInfo
  modelos: ModelInfo[]
  agentes: AgenteInfo[]
  tools: ToolInfo[]
  alertas: string[]
  versao: string
  bootTime: number
  ultimosLogs: string[]
}

export interface ProcessInfo {
  pid: number
  nome: string
  status: 'ativo' | 'idle' | 'processando'
  inicio: string
  ms: number
}

export interface MemoriaInfo {
  contextoAtual: number
  maxContexto: number
  chatAtivo: string | null
  totalMensagens: number
}

export interface ModelInfo {
  nome: string
  tipo: 'principal' | 'embed' | 'trainer'
  status: 'online' | 'offline' | 'loading'
  contexto: number
}

export interface AgenteInfo {
  nome: string
  status: 'online' | 'idle' | 'treinando'
  nicho: string
  usoCount: number
}

export interface ToolInfo {
  nome: string
  status: 'online' | 'offline'
  tipo: 'realtime' | 'io' | 'ai' | 'web'
}

const STATE_PATH = path.resolve(__dirname, '../../memory/systemState.json')
const LOG_PATH = path.resolve(__dirname, '../../memory/systemLog.json')

let _bootTime = Date.now()

export function getBootTime(): number {
  return _bootTime
}

function getUptime(): string {
  const ms = Date.now() - _bootTime
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export function carregarEstado(): SystemState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch { /* ignore */ }
  return criarEstadoInicial()
}

function criarEstadoInicial(): SystemState {
  return {
    uptime: '0s',
    uptimeMs: 0,
    processos: [],
    memoria: {
      contextoAtual: 0,
      maxContexto: 128000,
      chatAtivo: null,
      totalMensagens: 0,
    },
    modelos: [
      { nome: 'qwen2.5:14b', tipo: 'principal', status: 'loading', contexto: 128000 },
      { nome: 'nomic-embed-text:latest', tipo: 'embed', status: 'loading', contexto: 8192 },
    ],
    agentes: [
      { nome: 'agenteTeo', status: 'online', nicho: 'geral', usoCount: 0 },
      { nome: 'agenteProgramacao', status: 'idle', nicho: 'programacao', usoCount: 0 },
      { nome: 'agenteTrainer', status: 'idle', nicho: 'treinamento', usoCount: 0 },
    ],
    tools: [
      { nome: 'obterGeoPorIP', status: 'online', tipo: 'realtime' },
      { nome: 'obterHorario', status: 'online', tipo: 'realtime' },
      { nome: 'obterClima', status: 'online', tipo: 'realtime' },
      { nome: 'buscaWeb', status: 'online', tipo: 'web' },
      { nome: 'executarCodigo', status: 'online', tipo: 'io' },
      { nome: 'lerNicho', status: 'online', tipo: 'io' },
      { nome: 'escreverNicho', status: 'online', tipo: 'io' },
      { nome: 'carregarPerfil', status: 'online', tipo: 'ai' },
      { nome: 'salvarPerfil', status: 'online', tipo: 'ai' },
    ],
    alertas: [],
    versao: '1.0.0',
    bootTime: _bootTime,
    ultimosLogs: [],
  }
}

export function salvarEstado(estado: SystemState): void {
  try {
    const dir = path.dirname(STATE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(STATE_PATH, JSON.stringify(estado, null, 2))
  } catch (err) {
    console.error('Erro ao salvar estado:', err)
  }
}

export function atualizarEstado(partial: Partial<SystemState>): void {
  const estado = carregarEstado()
  Object.assign(estado, partial, {
    uptime: getUptime(),
    uptimeMs: Date.now() - _bootTime,
  })
  salvarEstado(estado)
}

export function logAcao(tipo: string, detalhes: string): void {
  const estado = carregarEstado()
  const entrada = `[${new Date().toISOString()}] [${tipo}] ${detalhes}`
  estado.ultimosLogs = [entrada, ...estado.ultimosLogs].slice(0, 50)
  salvarEstado(estado)
}

export function marcarAgenteUso(nome: string): void {
  const estado = carregarEstado()
  const agente = estado.agentes.find((a) => a.nome === nome)
  if (agente) {
    agente.usoCount++
    agente.status = 'online'
  }
  salvarEstado(estado)
}

export function formatarEstado(): string {
  const e = carregarEstado()
  const partes: string[] = []

  partes.push('## Estado do Sistema TEO')
  partes.push(`Uptime: ${e.uptime}`)
  partes.push(`Versão: ${e.versao}`)
  partes.push(`Chat ativo: ${e.memoria.chatAtivo ?? 'nenhum'}`)
  partes.push(`Mensagens em contexto: ${e.memoria.contextoAtual}`)
  partes.push('')
  partes.push('### Modelos')
  e.modelos.forEach((m) => {
    const emoji = m.status === 'online' ? '🟢' : m.status === 'loading' ? '🟡' : '🔴'
    partes.push(`${emoji} ${m.nome} (${m.tipo}) — ${m.status}`)
  })
  partes.push('')
  partes.push('### Agentes')
  e.agentes.forEach((a) => {
    const emoji = a.status === 'online' ? '🟢' : a.status === 'treinando' ? '🟡' : '⚪'
    partes.push(`${emoji} ${a.nome} — ${a.status} — nicho: ${a.nicho} — ${a.usoCount} usos`)
  })
  partes.push('')
  partes.push('### Ferramentas')
  e.tools.forEach((t) => {
    const emoji = t.status === 'online' ? '🟢' : '🔴'
    partes.push(`${emoji} ${t.nome} (${t.tipo})`)
  })

  return partes.join('\n')
}