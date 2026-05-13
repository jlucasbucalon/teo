// ============================================================
//  TEO — src/agents/agenteTeo.ts
//  Interface principal do Sistema Operacional
//  TEO responde como JARVIS — conhecendo o contexto completo
// ============================================================

import { ChatOllama } from '@langchain/ollama'
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages'
import { TEO } from '../aios'
import {
  obterRaciocinio,
  numBatch,
} from '../core/reasoning'
import { SYSTEM_PROMPT } from '../codex/prompt'
import type { EtapaAgente } from './agenteProgramacao'
import type { OpenAIMessage } from '../core/types'
import type { HardwareInfo } from '../system/hardware'
import type { ModoRaciocinio } from '../core/reasoning'

// ── Tipos ────────────────────────────────────────────────────

export interface AgenteTeoInput {
  messages: OpenAIMessage[]
  onToken: (token: string) => void
  hw: HardwareInfo
  modo: ModoRaciocinio
  topico: string
  input: string
  trainerContext?: string | null
  onEtapa?: ((etapa: EtapaAgente) => void) | null
  nicho?: string
}

export interface AgenteTeoOutput {
  resposta: string
  modelo: string
}

// ── Agente ───────────────────────────────────────────────────

export async function agenteTeo(
  input: AgenteTeoInput
): Promise<AgenteTeoOutput> {
  const modelo = TEO.modelo
  const r = obterRaciocinio(input.modo, input.hw)

  const systemContent = SYSTEM_PROMPT.content

  // ── LLM call ───────────────────────────────────────────────
  const llm = new ChatOllama({
    baseUrl: TEO.ollamaUrl,
    model: modelo,
    numThread: input.hw.params.num_thread,
    numGpu: input.hw.params.num_gpu,
    keepAlive: -1,
    numBatch: numBatch(input.hw),
    numCtx: r.num_ctx,
    numPredict: r.num_predict,
    temperature: r.temperature,
    repeatPenalty: r.repeat_penalty,
    topK: r.top_k,
    topP: r.top_p,
  })

  const lcMessages = [
    new SystemMessage(systemContent),
    ...input.messages
      .filter((m) => m.role !== 'system')
      .map((m: OpenAIMessage) =>
        m.role === 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content)
      ),
  ]

  input.onEtapa?.({ tipo: 'respondendo' })

  let resposta = ''
  try {
    const stream = await llm.stream(lcMessages)
    for await (const chunk of stream) {
      const token =
        typeof chunk.content === 'string'
          ? chunk.content
          : ''
      if (token) {
        input.onToken(token)
        resposta += token
      }
    }
  } catch (err) {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      await new Promise((res) =>
        setTimeout(res, tentativa * 1000)
      )
      try {
        const stream = await llm.stream(lcMessages)
        for await (const chunk of stream) {
          const token =
            typeof chunk.content === 'string'
              ? chunk.content
              : ''
          if (token) {
            input.onToken(token)
            resposta += token
          }
        }
        break
      } catch {
        /* retry */
      }
    }
  }

  return { resposta: resposta.trim(), modelo }
}
