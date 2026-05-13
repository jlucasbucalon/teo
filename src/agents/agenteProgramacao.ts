// ============================================================
//  TEO — src/agents/agenteProgramacao.ts
//  Agente especializado em programação.
//  Fluxo fixo (sem tool calling via LLM):
//    1. lerNicho / lerContextoFocado → carrega seções relevantes do .md
//    2. buscaWeb  → busca informações atuais (condicional por modo)
//    3. Injeta contexto no system prompt
//    4. ChatOllama stream → resposta final
// ============================================================

import { ChatOllama } from '@langchain/ollama'
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages'
import { TEO } from '../aios'
import { buscaWeb, decidirBusca } from '../tools/buscaWeb'
import {
  lerNicho,
  lerContextoFocado,
} from '../tools/lerVector'
import { obterRaciocinio } from '../core/reasoning'
import { SYSTEM_PROMPT } from '../codex/prompt'
import type { OpenAIMessage } from '../core/types'
import type { HardwareInfo } from '../system/hardware'
import type { ModoRaciocinio } from '../core/reasoning'

// ── Tipos ────────────────────────────────────────────────────

export type EtapaAgente =
  | { tipo: 'lendo_conhecimento'; nicho: string }
  | { tipo: 'buscando_web'; query: string }
  | { tipo: 'pensando' }
  | { tipo: 'respondendo' }

export interface AgenteProgramacaoInput {
  messages: OpenAIMessage[]
  onToken: (token: string) => void
  trainerContext: string
  hw: HardwareInfo
  modo: ModoRaciocinio
  topico: string
  input: string
  onEtapa?: (etapa: EtapaAgente) => void
}

export interface AgenteProgramacaoOutput {
  resposta: string
  modelo: string
}

// ── Contexto adicional de programação ───────────────────────

const CONTEXTO_PROGRAMACAO = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESPECIALIZAÇÃO: PROGRAMAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Neste contexto você atua como especialista em programação e desenvolvimento de software.

Você recebe dois contextos de referência para responder:
1. Conhecimento acumulado do nicho (.md) — base interna já aprendida
2. Informações atuais da web — dados recentes sobre o assunto

PRIORIDADE DAS FONTES (sempre nesta ordem):
1. Informações da web (mais recentes)
2. Conhecimento do nicho (.md)
3. Seu conhecimento base

Quando usar informação da web, indique a fonte no final: (fonte: web — [título])`

// ── Agente ───────────────────────────────────────────────────

export async function agenteProgramacao(
  input: AgenteProgramacaoInput
): Promise<AgenteProgramacaoOutput> {
  const modelo = TEO.agenteCodigoModel ?? TEO.modelo
  const r = obterRaciocinio(input.modo, input.hw)

  // ── Passo 1: lê o conhecimento acumulado (.md) ───────────
  input.onEtapa?.({
    tipo: 'lendo_conhecimento',
    nicho: 'programacao',
  })
  console.log(
    '[agenteProgramacao] Lendo conhecimento acumulado...'
  )

  const conhecimento = await lerNicho('programacao')
  const temConhecimento = conhecimento.temConhecimento

  console.log(
    `[agenteProgramacao] Conhecimento: ${temConhecimento ? 'carregado' : 'vazio'}`
  )

  // Retorna só as seções relevantes para este input
  const contextoFocado = temConhecimento
    ? await lerContextoFocado('programacao', input.input, 3)
    : ''

  // ── Passo 2: busca web condicional por modo ───────────────
  const partes: string[] = [
    SYSTEM_PROMPT.content,
    CONTEXTO_PROGRAMACAO,
  ]

  if (contextoFocado) {
    partes.push(`\n${contextoFocado}`)
  }

  const decisao = decidirBusca(input.modo)
  console.log(
    `[agenteProgramacao] Busca web: ${decisao.buscar ? 'sim' : 'não'} (modo=${input.modo})`
  )

  if (decisao.buscar) {
    input.onEtapa?.({
      tipo: 'buscando_web',
      query: input.input, // ← era input.topico
    })
    console.log(
      `[agenteProgramacao] Buscando: "${input.input}"` // ← era input.topico
    )

    const webResult = await buscaWeb(
      input.input, // ← era input.topico
      decisao.maxResultados,
      'programacao'
    )
    console.log(
      `[agenteProgramacao] Resultados web: ${webResult.resultados.length}`
    )

    if (webResult.resultados.length > 0) {
      const webTexto = webResult.resultados
        .map(
          (r) =>
            `### ${r.title}\nURL: ${r.url}\n${r.content}`
        )
        .join('\n\n')
      partes.push(
        `\n## Informações Atuais da Web\n${webTexto}`
      )
    }
  }

  if (input.trainerContext.trim()) {
    partes.push(
      `\n## Contexto Adicional\n${input.trainerContext}`
    )
  }

  const systemContent = partes.join('\n')

  // ── Passo 3: chama o modelo com contexto completo ────────
  const llm = new ChatOllama({
    baseUrl: TEO.ollamaUrl,
    model: modelo,
    numThread: input.hw.params.num_thread,
    numGpu: input.hw.params.num_gpu,
    keepAlive: -1,
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
      .map((m) =>
        m.role === 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content)
      ),
  ]

  input.onEtapa?.({ tipo: 'respondendo' })

  let resposta = ''
  const stream = await llm.stream(lcMessages)

  for await (const chunk of stream) {
    const token =
      typeof chunk.content === 'string' ? chunk.content : ''
    if (token) {
      input.onToken(token)
      resposta += token
    }
  }

  return { resposta: resposta.trim(), modelo }
}
