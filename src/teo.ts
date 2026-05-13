// ============================================================
//  TEO — src/core/teo.ts
//  AI central — orquestrador LangGraph + memória persistente
//
//  Usa carregarMemoria/salvarMemoria de chat/modules.ts para
//  evitar duplicação de lógica de histórico.
// ============================================================

import { TEO } from './aios'
import {
  detectarHardware,
  relatorioHardware,
  type HardwareInfo,
} from './system/hardware'
import {
  detectarHardwareRemoto,
  relatorioHardwareRemoto,
  type HardwareRemotoInfo,
} from './system/remoteHardware'
import { printHardware } from './terminal/ui.js'
import { runTeoGraph } from './codex/graph'
import { embedTexto } from './core/embed'
import {
  carregarMemoria,
  salvarMemoria,
} from './chat/modules'
import type { Compreensao } from './core/understand'
import type { OpenAIMessage } from './core/types'
import type { EtapaAgente } from './agents/agenteProgramacao'

// ── Hardware cache com TTL ─────────────────────────────────────

type AnyHwInfo = HardwareInfo | HardwareRemotoInfo

interface HwCache {
  hw: AnyHwInfo
  timestamp: number
}
const _cache: {
  local: HwCache | null
  remoto: HwCache | null
} = {
  local: null,
  remoto: null,
}
const HW_TTL_MS = 5 * 60 * 1000 // 5 minutos

function ehRemota(url: string): boolean {
  return (
    !url.includes('localhost') &&
    !url.includes('127.0.0.1') &&
    !url.includes('::1')
  )
}

function getHwFresco(): AnyHwInfo | null {
  const cache = ehRemota(TEO.ollamaUrl)
    ? _cache.remoto
    : _cache.local
  if (cache && Date.now() - cache.timestamp < HW_TTL_MS)
    return cache.hw
  return null
}

export async function inicializarHardware(): Promise<void> {
  const fresco = getHwFresco()
  if (fresco) return

  if (ehRemota(TEO.ollamaUrl)) {
    const hwRemoto = await detectarHardwareRemoto(
      TEO.ollamaUrl
    )
    printHardware(relatorioHardwareRemoto(hwRemoto))
    _cache.remoto = { hw: hwRemoto, timestamp: Date.now() }
  } else {
    const hw = detectarHardware()
    printHardware(relatorioHardware(hw))
    _cache.local = { hw, timestamp: Date.now() }
  }
}

function getHw(): AnyHwInfo {
  return getHwFresco() ?? detectarHardware()
}

export function invalidarCacheHardware(): void {
  _cache.local = null
  _cache.remoto = null
}

// ── Chat com LangGraph ─────────────────────────────────────────

export interface TeoChatOptions {
  compreensao?: Compreensao | null
  trainerContext?: string | null
}

export async function teoChat(
  messages: OpenAIMessage[],
  onToken: (token: string) => void,
  chatId?: string | null,
  options?: TeoChatOptions,
  onEtapa?: (etapa: EtapaAgente) => void
): Promise<{
  resposta: string
  compreensao: Compreensao | null
  modeloUsado: string
}> {
  const hw = getHw()
  const id = chatId ?? null

  // Carrega histórico via modules.ts (fonte única)
  const historicoCompleto = id ? carregarMemoria(id) : []
  const userMsg = messages
    .filter((m) => m.role === 'user')
    .at(-1)
  const jaExiste = userMsg
    ? historicoCompleto.some(
        (m) =>
          m.role === 'user' && m.content === userMsg.content
      )
    : true

  if (!jaExiste && userMsg) {
    historicoCompleto.push({
      ...userMsg,
      embed: userMsg.embed ?? [],
    })
  }

  // Resolve opcionais
  const preCompreensao =
    options?.compreensao !== undefined
      ? options.compreensao
      : null
  const trainerCtx =
    options?.trainerContext !== undefined
      ? options.trainerContext
      : null

  const { resposta, compreensao, modeloUsado } =
    await runTeoGraph({
      messages: historicoCompleto,
      onToken,
      chatId: id,
      hw,
      compreensao: preCompreensao,
      trainerContext: trainerCtx,
      onEtapa: onEtapa ?? null,
    })

  // Persiste via modules.ts — embed da resposta com timeout
  if (id && resposta) {
    const memoriaAtualizada = carregarMemoria(id)
    const ultimaUser = messages.find(
      (m) => m.role === 'user'
    )

    if (ultimaUser) {
      const tem = memoriaAtualizada.some(
        (m) =>
          m.role === 'user' &&
          m.content === ultimaUser.content
      )
      if (!tem) {
        memoriaAtualizada.push({
          ...ultimaUser,
          embed: compreensao?.embed ?? [],
        })
      }
    }

    // Embed da resposta com timeout de 3s — não bloqueia se falhar
    const embedPromise = embedTexto(resposta).catch(
      () => [] as number[]
    )
    const timeout = new Promise<number[]>((resolve) =>
      setTimeout(() => resolve([]), 3000)
    )
    const assistantEmbed = await Promise.race([
      embedPromise,
      timeout,
    ])

    memoriaAtualizada.push({
      role: 'assistant',
      content: resposta,
      embed: assistantEmbed,
    })
    await salvarMemoria(id, memoriaAtualizada)
  }

  return { resposta, compreensao, modeloUsado }
}
