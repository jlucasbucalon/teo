// ============================================================
//  TEO — src/kernel/kernel.ts
//  KERNEL DO SISTEMA OPERACIONAL
//  Gerencia processos, memória, I/O e orquestração central
// ============================================================

import {
  formatarPerfil,
  carregarPerfil,
  salvarPerfil,
} from '../memory/userProfile'
import {
  formatarEstado,
  atualizarEstado,
  marcarAgenteUso,
  logAcao,
} from '../memory/systemState'
import {
  formatarSystemInfo,
  getVariaveisAmbiente,
} from '../tools/osTools'

// ── Tipos do Kernel ────────────────────────────────────────

export interface KernelContext {
  perfil: string
  estado: string
  sistema: string
  timestamp: number
}

export interface KernelDecision {
  acao:
    | 'responder'
    | 'buscar_web'
    | 'executar'
    | 'treinar'
    | 'consultar_ferramenta'
  confianca: number
  reason: string
}

export type KernelPriority =
  | 'critical'
  | 'high'
  | 'normal'
  | 'low'

export interface KernelTask {
  id: string
  tipo: string
  prioridade: KernelPriority
  data: Record<string, unknown>
  status: 'pending' | 'running' | 'done' | 'error'
  inicio: number
  resultado?: unknown
  erro?: string
}

// ── Kernel Core ─────────────────────────────────────────────

let _taskCounter = 0

export function novoTaskId(): string {
  return `task_${Date.now()}_${++_taskCounter}`
}

export async function buildKernelContext(): Promise<KernelContext> {
  const [perfil, estado, sistema] =
    await Promise.all([
      Promise.resolve(formatarPerfil()),
      Promise.resolve(formatarEstado()),
      Promise.resolve(formatarSystemInfo()),
    ])

  return {
    perfil,
    estado,
    sistema,
    timestamp: Date.now(),
  }
}

export function formatarKernelContext(
  ctx: KernelContext
): string {
  const partes: string[] = []

  partes.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  partes.push('KERNEL — CONTEXTO OPERACIONAL DO TEO')
  partes.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  partes.push('')
  partes.push(ctx.perfil)
  partes.push('')
  partes.push(ctx.estado)

  return partes.join('\n')
}

// ── Decisões automáticas ────────────────────────────────────

export function decidaPrioridade(
  input: string
): KernelDecision {
  const t = input.toLowerCase()

  // Critical: emergência, crash, erro urgente
  if (
    /\b(ajuda|help|erro|crash|falhou|falha|problema|bug|emergency)\b/i.test(
      t
    )
  ) {
    return {
      acao: 'responder',
      confianca: 0.95,
      reason: 'Input crítico — resposta imediata',
    }
  }

  // Executar código
  if (
    /\b(executa|roda|testa|run|execute|roda isso)\b/i.test(
      t
    )
  ) {
    return {
      acao: 'executar',
      confianca: 0.9,
      reason: 'Comando de execução detectado',
    }
  }

  // Treinar/aprender
  if (
    /\b(ensina|treina|aprender|ensine|lembra)\b/i.test(t)
  ) {
    return {
      acao: 'treinar',
      confianca: 0.85,
      reason: 'Requisição de aprendizado',
    }
  }

  // Buscar web
  if (
    /\b(busca|pesquisa|google|search|procurar|noticia|notícia)\b/i.test(
      t
    )
  ) {
    return {
      acao: 'buscar_web',
      confianca: 0.8,
      reason: 'Requisição de busca na web',
    }
  }

  // Consultar ferramenta do sistema
  if (
    /\b(hora|data|clima|clima|estado do sistema|status|que horas|que dia)\b/i.test(
      t
    )
  ) {
    return {
      acao: 'consultar_ferramenta',
      confianca: 0.9,
      reason: 'Query de dados operacionais',
    }
  }

  return {
    acao: 'responder',
    confianca: 0.7,
    reason: 'Conversa normal',
  }
}

// ── Processamento assíncrono ────────────────────────────────

const _tasks: Map<string, KernelTask> = new Map()

export function criarTask(
  tipo: string,
  prioridade: KernelPriority,
  data: Record<string, unknown>
): KernelTask {
  const task: KernelTask = {
    id: novoTaskId(),
    tipo,
    prioridade,
    data,
    status: 'pending',
    inicio: Date.now(),
  }
  _tasks.set(task.id, task)
  return task
}

export function getTasks(): KernelTask[] {
  return Array.from(_tasks.values())
}

export function getTasksPorPrioridade(
  prioridade: KernelPriority
): KernelTask[] {
  return Array.from(_tasks.values()).filter(
    (t) =>
      t.prioridade === prioridade && t.status === 'pending'
  )
}

export function marcarTaskDone(
  taskId: string,
  resultado: unknown
): void {
  const task = _tasks.get(taskId)
  if (task) {
    task.status = 'done'
    task.resultado = resultado
    logAcao(
      'TASK_DONE',
      `${task.tipo} — ${taskId} concluído em ${Date.now() - task.inicio}ms`
    )
  }
}

export function marcarTaskError(
  taskId: string,
  erro: string
): void {
  const task = _tasks.get(taskId)
  if (task) {
    task.status = 'error'
    task.erro = erro
    logAcao(
      'TASK_ERROR',
      `${task.tipo} — ${taskId} erro: ${erro}`
    )
  }
}

export function limparTasksAntigas(
  maxAgeMs = 5 * 60 * 1000
): void {
  const agora = Date.now()
  for (const [id, task] of _tasks) {
    if (
      task.status === 'done' &&
      agora - task.inicio > maxAgeMs
    ) {
      _tasks.delete(id)
    }
  }
}

// ── Auto-update perfil ──────────────────────────────────────

export function aprenderDoInput(
  input: string,
  resposta: string
): void {
  const perfil = carregarPerfil()

  // Detectar interesses por keywords
  const keywords = [
    'programação',
    'código',
    'python',
    'javascript',
    'java',
    'typescript',
    'hardware',
    'computador',
    'pc',
    'server',
    'servidor',
    'rede',
    'network',
    'docker',
    'linux',
    'windows',
    'ia',
    'ai',
    'machine learning',
    'nlp',
    'web',
    'frontend',
    'backend',
    'api',
  ]

  keywords.forEach((kw) => {
    if (
      input.toLowerCase().includes(kw) &&
      !perfil.interesses.includes(kw)
    ) {
      perfil.interesses.push(kw)
    }
  })

  salvarPerfil(perfil)
}

// ── Injeção de contexto para agente ─────────────────────────

export async function buildSystemContext(
  injectAsSystem = true
): Promise<string> {
  const ctx = await buildKernelContext()
  const parts: string[] = []

  // Identidade
  parts.push('## Contexto Operacional TEO')

  // Perfil
  parts.push(ctx.perfil)

  // Estado do sistema
  parts.push(ctx.estado)

  // Sistema operacional
  parts.push(ctx.sistema)

  // Variaveis de ambiente (não sensíveis)
  const vars = getVariaveisAmbiente()
  const naoSensiveis = vars.filter(
    (v) => !/KEY|SECRET|PASS|TOKEN|API/i.test(v.nome)
  )
  if (naoSensiveis.length > 0) {
    const envLines = naoSensiveis
      .slice(0, 10)
      .map((v) => `  ${v.nome}=${v.valor}`)
      .join('\n')
    parts.push(
      `## Variaveis de Ambiente (não sensíveis)\n${envLines}`
    )
  }

  return parts.join('\n\n')
}
