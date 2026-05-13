#!/usr/bin/env node

// ============================================================
//  TEO — src/terminal/cli.ts
//  Interface de linha de comando
// ============================================================

import readline from 'readline'
import { TEO } from '../aios'
import { teoChat } from '../teo'
import {
  formatPrompt,
  printResponse,
  printStreamHeader,
  printStreamEnd,
  printError,
  printReset,
  printExit,
  printModo,
  printInfo,
  startSpinner,
  stopSpinner,
} from './ui'
import { setModo, getModo } from '../core/reasoning'
import { entender } from '../core/understand'
import { treinarNicho } from '../agents/agenteTrainer'
import type { OpenAIMessage } from '../core/types'

import * as chatModule from '../chat/modules'
const {
  interpretar,
  estado: chatEstado,
  carregarMemoria,
  salvarMemoria,
  gerarChatId,
  criarChat,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = chatModule as any

// ── Histórico em memória (sem chat aberto) ───────────────────

let memoryHistory: OpenAIMessage[] = []

// ── Readline ─────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// ── Histórico ativo ──────────────────────────────────────────

function getHistory(): OpenAIMessage[] {
  if (chatEstado.chatAtual) {
    return (
      (carregarMemoria(
        chatEstado.chatAtual
      ) as OpenAIMessage[]) ?? []
    )
  }
  return memoryHistory
}

async function saveHistory(
  history: OpenAIMessage[]
): Promise<void> {
  if (chatEstado.chatAtual) {
    await salvarMemoria(chatEstado.chatAtual, history)
  } else {
    memoryHistory = history
  }
}

// ── Conversa com LLM ─────────────────────────────────────────

async function perguntar(input: string): Promise<void> {
  // Auto-cria chat se nenhum estiver aberto
  if (!chatEstado.chatAtual) {
    const novoId = gerarChatId() as string
    criarChat(novoId)
    printInfo(
      `chat ${novoId} criado  —  use "teo fechar chat" para encerrar`
    )
  }

  const history = getHistory()
  history.push({ role: 'user', content: input })
  await saveHistory(history)

  const inicio = Date.now()
  startSpinner(TEO.modelo)

  let primeiroToken = true

  try {
    const { resposta } = await teoChat(
      history,
      (token) => {
        if (primeiroToken) {
          stopSpinner()
          printStreamHeader(TEO.modelo, getModo())
          primeiroToken = false
        }
        process.stdout.write(token)
      },
      chatEstado.chatAtual ?? null,
      { compreensao: null, trainerContext: null }
    )

    if (primeiroToken) stopSpinner()
    printStreamEnd(Date.now() - inicio)

    history.push({ role: 'assistant', content: resposta })
    await saveHistory(history)

    // Fire-and-forget — classifica e treina APÓS a resposta
    if (TEO.trainerKey) {
      const chatId = chatEstado.chatAtual ?? null
      entender(input, chatId)
        .then((compreensao) =>
          treinarNicho({
            nicho: compreensao.nicho,
            topico: compreensao.topico,
            input,
            resposta,
            chatId,
          })
        )
        .catch((err) =>
          console.error(
            '[trainer erro]',
            err?.message ?? String(err)
          )
        )
    }
  } catch (err) {
    stopSpinner()
    const msg =
      err instanceof Error
        ? err.message
        : 'erro desconhecido'
    printError(msg)
  }
}

// ── Loop principal ────────────────────────────────────────────

function loop(): void {
  rl.question(
    formatPrompt(chatEstado.chatAtual),
    async (input) => {
      const texto = input.trim()

      if (!texto) return loop()

      const t = texto.toLowerCase()

      // Modo de raciocínio
      const modoMatch = t.match(
        /^teo modo (local|local|online)$/
      )
      if (modoMatch) {
        const arg =
          modoMatch[1] === 'local' ? 'local' : modoMatch[1]!
        if (setModo(arg)) printModo(arg)
        else
          printInfo(
            'Use: teo modo local  ou  teo modo online'
          )
        return loop()
      }

      // Histórico de conversa
      if (
        [
          'teo historico',
          'teo histórico',
          'teo history',
        ].includes(t)
      ) {
        const hist = getHistory()
        if (hist.length === 0) {
          printReset()
        } else {
          hist.forEach((m, i) =>
            printInfo(
              `[${i + 1}] ${m.role}: ${String(m.content).slice(0, 80)}...`
            )
          )
        }
        return loop()
      }

      // Status do sistema
      if (
        ['teo status', 'teo estado', 'teo info'].includes(t)
      ) {
        const chat = chatEstado.chatAtual
          ? `Chat: ${chatEstado.chatAtual}`
          : 'Sem chat aberto'
        printInfo(
          `TEO operacional  |  modo: ${getModo()}  |  ${chat}  |  modelo: ${TEO.modelo}`
        )
        return loop()
      }

      // Comandos de chat (criar/abrir/fechar/listar/etc.) e demais comandos
      const resultadoChat: string | null =
        await interpretar(texto)
      if (resultadoChat !== null) {
        if (resultadoChat === '__sair__') {
          printExit()
          process.exit(0)
        }
        printResponse({
          texto: resultadoChat,
          modelo: 'TEO',
          modo: 'cmd',
        })
        return loop()
      }

      // LLM
      await perguntar(texto)
      loop()
    }
  )
}

loop()
