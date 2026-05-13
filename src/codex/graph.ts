// ============================================================
//  TEO — src/core/graph.ts
//  Pipeline LangGraph — orquestra compreensão e resposta
//
//  Fluxo:
//    START → understand → (roteamento por modo)
//              ├── respond_local   (modo local)
//              └── respond_profundo (modo profundo)
//            → END
//
//  Nodes extraídos para: src/core/graph/nodes.ts
// ============================================================

import {
  Annotation,
  StateGraph,
  START,
  END,
} from '@langchain/langgraph'
import {
  classificarRapido,
  type Compreensao,
} from '../core/understand'
import { obterRaciocinio, getModo } from '../core/reasoning'
import {
  buildLLM,
  construirContexto,
  routeByMode,
  type Rota,
} from './nodes'
import { agenteProgramacao } from '../agents/agenteProgramacao'
import { agenteTeo } from '../agents/agenteTeo'
import { TEO } from '../aios'
import { buildSystemContext } from './kernel'
import type { OpenAIMessage } from '../core/types'
import type { HardwareInfo } from '../system/hardware'
import type { EtapaAgente } from '../agents/agenteProgramacao'

// ── Estado do grafo ──────────────────────────────────────────

const TeoState = Annotation.Root({
  messages: Annotation<OpenAIMessage[]>({
    reducer: (_: OpenAIMessage[], y: OpenAIMessage[]) => y,
    default: (): OpenAIMessage[] => [],
  }),
  chatId: Annotation<string | null>({
    reducer: (_: string | null, y: string | null) => y,
    default: (): null => null,
  }),
  hw: Annotation<HardwareInfo | null>({
    reducer: (
      _: HardwareInfo | null,
      y: HardwareInfo | null
    ) => y,
    default: (): null => null,
  }),
  onToken: Annotation<((token: string) => void) | null>({
    reducer: (_, y) => y,
    default: (): null => null,
  }),
  compreensao: Annotation<Compreensao | null>({
    reducer: (_, y) => y,
    default: (): null => null,
  }),
  trainerContext: Annotation<string | null>({
    reducer: (_: string | null, y: string | null) => y,
    default: (): null => null,
  }),
  resposta: Annotation<string>({
    reducer: (_: string, y: string) => y,
    default: (): string => '',
  }),
  modeloUsado: Annotation<string>({
    reducer: (_: string, y: string) => y,
    default: (): string => '',
  }),
  onEtapa: Annotation<
    ((etapa: EtapaAgente) => void) | null
  >({
    reducer: (_, y) => y,
    default: (): null => null,
  }),
})

type TeoStateType = typeof TeoState.State

// ── Nó: understand ────────────────────────────────────────────

async function understandNode(
  state: TeoStateType
): Promise<Partial<TeoStateType>> {
  if (state.compreensao !== null) return {}

  const lastMsg = [...state.messages]
    .reverse()
    .find((m) => m.role === 'user')
  if (!lastMsg) return {}

  const compreensao = classificarRapido(lastMsg.content)
  return { compreensao }
}

// ── Roteamento ────────────────────────────────────────────────

function routeNode(state: TeoStateType): Rota {
  return routeByMode(state.compreensao, getModo())
}

// ── Nó: respond ───────────────────────────────────────────────

async function respondNode(
  state: TeoStateType,
  modo: 'local' | 'online'
): Promise<Partial<TeoStateType>> {
  const hw = state.hw!
  const r = obterRaciocinio(modo, hw)
  const onToken = state.onToken ?? (() => undefined)

  const contextMsgs = construirContexto(
    state.messages,
    state.compreensao,
    r
  )
  const ultimaMsgUsuario =
    [...contextMsgs]
      .reverse()
      .find((m) => m.role === 'user')?.content ?? ''
  const topico =
    state.compreensao?.topico ?? ultimaMsgUsuario

  // Build contexto operacional UNA única vez
  const trainerContext = await buildSystemContext()

  // Dispatch para agente especializado
  if (state.compreensao?.nicho === 'geral') {
    const { resposta, modelo } = await agenteTeo({
      messages: contextMsgs,
      onToken,
      hw,
      modo,
      topico,
      input: ultimaMsgUsuario,
      trainerContext,
      nicho: state.compreensao?.nicho,
      ...(state.onEtapa ? { onEtapa: state.onEtapa } : {}),
    })
    return { resposta, modeloUsado: modelo }
  }

  if (
    state.compreensao?.nicho === 'programacao' &&
    TEO.agenteCodigoModel
  ) {
    const { resposta, modelo } = await agenteProgramacao({
      messages: contextMsgs,
      onToken,
      trainerContext,
      hw,
      modo,
      topico,
      input: ultimaMsgUsuario,
      ...(state.onEtapa ? { onEtapa: state.onEtapa } : {}),
    })
    return { resposta, modeloUsado: modelo }
  }

  // Fallback: LLM direto
  const llm = buildLLM(hw, modo)
  let resposta = ''

  const stream = await llm.stream(
    contextMsgs
      .filter((m) => m.role !== 'system')
      .map((m) =>
        m.role === 'user'
          ? { role: 'user' as const, content: m.content }
          : {
              role: 'assistant' as const,
              content: m.content,
            }
      )
  )

  for await (const chunk of stream) {
    const token =
      typeof chunk.content === 'string' ? chunk.content : ''
    if (token) {
      onToken(token)
      resposta += token
    }
  }

  return { resposta, modeloUsado: TEO.modelo }
}

// ── Grafo compilado ──────────────────────────────────────────

const teoGraph = new StateGraph(TeoState)
  .addNode('understand', understandNode)
  .addNode('respond_local', (s) =>
    respondNode(s, 'local')
  )
  .addNode('respond_online', (s) =>
    respondNode(s, 'online')
  )
  .addEdge(START, 'understand')
  .addConditionalEdges('understand', routeNode, {
    local: 'respond_local',
    online: 'respond_online',
  })
  .addEdge('respond_local', END)
  .addEdge('respond_online', END)
  .compile()

// ── API pública ───────────────────────────────────────────────

export interface TeoGraphInput {
  messages: OpenAIMessage[]
  onToken: (token: string) => void
  chatId: string | null
  hw: HardwareInfo
  compreensao?: Compreensao | null
  trainerContext?: string | null
  onEtapa?: ((etapa: EtapaAgente) => void) | null
}

export interface TeoGraphResult {
  resposta: string
  compreensao: Compreensao | null
  modeloUsado: string
}

export async function runTeoGraph(
  input: TeoGraphInput
): Promise<TeoGraphResult> {
  const result = await teoGraph.invoke({
    messages: input.messages,
    chatId: input.chatId,
    hw: input.hw,
    onToken: input.onToken,
    compreensao: input.compreensao ?? null,
    trainerContext: input.trainerContext ?? null,
    onEtapa: input.onEtapa ?? null,
    resposta: '',
  })

  return {
    resposta: result.resposta,
    compreensao: result.compreensao,
    modeloUsado: result.modeloUsado,
  }
}
