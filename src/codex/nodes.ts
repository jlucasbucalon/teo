// ============================================================
//  TEO — src/core/graph/nodes.ts
//  Nós reutilizáveis do LangGraph
// ============================================================

import { ChatOllama } from '@langchain/ollama'
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages'
import { TEO } from '../aios'
import { obterRaciocinio, getModo } from '../core/reasoning'
import { buscarMensagensSimilares } from '../core/embed'
import { SYSTEM_PROMPT } from './prompt'
import { agenteProgramacao } from '../agents/agenteProgramacao'
import { agenteTeo } from '../agents/agenteTeo'
import type { Compreensao } from '../core/understand'
import type { OpenAIMessage } from '../core/types'
import type { HardwareInfo } from '../system/hardware'
import type { ModoRaciocinio } from '../core/reasoning'
import type { EtapaAgente } from '../agents/agenteProgramacao'

// ── Build LLM helper ────────────────────────────────────────

function numBatch(hw: HardwareInfo): number {
  if (hw.gpu.vramGB >= 12) return 2048
  if (hw.gpu.vramGB >= 8) return 1024
  if (hw.gpu.vramGB >= 4) return 512
  if (hw.ram.livreGB >= 6) return 512
  if (hw.ram.livreGB >= 3) return 256
  return 128
}

export function buildLLM(
  hw: HardwareInfo,
  modo: ModoRaciocinio
): ChatOllama {
  const r = obterRaciocinio(modo, hw)

  return new ChatOllama({
    baseUrl: TEO.ollamaUrl,
    model: TEO.modelo,
    numThread: hw.params.num_thread,
    numGpu: hw.params.num_gpu,
    keepAlive: -1,
    numBatch: numBatch(hw),
    numCtx: r.num_ctx,
    numPredict: r.num_predict,
    temperature: r.temperature,
    repeatPenalty: r.repeat_penalty,
    topK: r.top_k,
    topP: r.top_p,
  })
}

// ── Contexto de mensagens ───────────────────────────────────

export function construirContexto(
  messages: OpenAIMessage[],
  compreensao: Compreensao | null,
  r: ReturnType<typeof obterRaciocinio>
): OpenAIMessage[] {
  const historico = messages.filter(
    (m) => m.role !== 'system'
  )
  const queryEmbed = compreensao?.embed ?? []

  if (!queryEmbed.length) {
    return historico.slice(-r.memoriaContextoMax)
  }

  const kSemantico = Math.ceil(r.memoriaContextoMax * 0.6)
  const kRecente = Math.floor(r.memoriaContextoMax * 0.4)

  const semanticos = buscarMensagensSimilares(
    queryEmbed,
    historico,
    kSemantico
  )
  const recentes = historico.slice(-kRecente)

  const vistos = new Set<OpenAIMessage>()
  const combined = [...semanticos, ...recentes].filter(
    (m) => {
      if (vistos.has(m)) return false
      vistos.add(m)
      return true
    }
  )

  return historico.filter((m) => combined.includes(m))
}

// ── Router ───────────────────────────────────────────────────

export type Rota = 'local' | 'online'

export function routeByMode(
  compreensao: Compreensao | null,
  modoManual: ModoRaciocinio
): Rota {
  // modo manual override tudo
  if (modoManual === 'online') return 'online'
  return 'local'
}

// ── Dispatcher de agentes ───────────────────────────────────

interface AgentInput {
  messages: OpenAIMessage[]
  onToken: (token: string) => void
  hw: HardwareInfo
  modo: ModoRaciocinio
  topico: string
  input: string
  trainerContext: string | null
  onEtapa: ((etapa: EtapaAgente) => void) | null
  nicho: string
}

export async function dispatchAgente(
  input: AgentInput
): Promise<{ resposta: string; modelo: string }> {
  const {
    messages,
    onToken,
    hw,
    modo,
    topico,
    input: userInput,
    nicho,
  } = input

  // Nicho geral → agenteTeo
  if (nicho === 'geral') {
    return agenteTeo({
      messages,
      onToken,
      hw,
      modo,
      topico,
      input: userInput,
      trainerContext: input.trainerContext,
      nicho,
      ...(input.onEtapa ? { onEtapa: input.onEtapa } : {}),
    })
  }

  // Nicho programação + modelo especialista → agenteProgramacao
  if (nicho === 'programacao' && TEO.agenteCodigoModel) {
    return agenteProgramacao({
      messages,
      onToken,
      trainerContext: input.trainerContext ?? '',
      hw,
      modo,
      topico,
      input: userInput,
      ...(input.onEtapa ? { onEtapa: input.onEtapa } : {}),
    })
  }

  // Fallback: LLM direto
  return callDirectLLM(input)
}

// ── LLM direto ───────────────────────────────────────────────

async function callDirectLLM(
  input: AgentInput
): Promise<{ resposta: string; modelo: string }> {
  const { messages, onToken, hw, modo, trainerContext } =
    input

  const systemContent = trainerContext
    ? `${SYSTEM_PROMPT.content}\n\n## Contexto do Trainer\n${trainerContext}`
    : SYSTEM_PROMPT.content

  const llm = buildLLM(hw, modo)
  const contextMsgs = messages.filter(
    (m) => m.role !== 'system'
  )

  const lcMessages = [
    new SystemMessage(systemContent),
    ...contextMsgs.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    ),
  ]

  let resposta = ''
  const stream = await llm.stream(lcMessages)

  for await (const chunk of stream) {
    const token =
      typeof chunk.content === 'string' ? chunk.content : ''
    if (token) {
      onToken(token)
      resposta += token
    }
  }

  return { resposta, modelo: TEO.modelo }
}
