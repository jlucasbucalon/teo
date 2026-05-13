#!/usr/bin/env node

// ============================================================
//  TEO — src/aios.ts
//  Núcleo do Sistema Operacional de IAs — boot, config e shutdown
// ============================================================

import dotenv from 'dotenv'
import path from 'path'
import axios from 'axios'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Validação ─────────────────────────────────────────────────

function required(name: string, value?: string): string {
  if (!value)
    throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

const TEO_MODELO = required(
  'TEO_MODELO',
  process.env.TEO_MODELO
)
const OLLAMA_URL = required(
  'OLLAMA_URL',
  process.env.OLLAMA_URL
)
const TEO_PORTA = Number(process.env.TEO_PORTA ?? 3000)
const TEO_EMBED =
  process.env.TEO_EMBED ?? 'nomic-embed-text:latest'
const TEO_TRAINER_KEY =
  process.env.TEO_TRAINER_KEY ??
  process.env.TEO_TRAINER ??
  null
const TEO_TRAINER_MODEL =
  process.env.TEO_TRAINER_MODEL ?? 'gemini-2.5-flash-lite'
const TEO_TRAINER_URL =
  process.env.TEO_TRAINER_URL ??
  'https://generativelanguage.googleapis.com/v1beta'
const AGENTE_CODIGO_MODEL =
  process.env.AGENTE_CODIGO_MODEL ?? null

if (Number.isNaN(TEO_PORTA))
  throw new Error('TEO_PORTA inválida')

// ── Configuração ──────────────────────────────────────────────

export const TEO = {
  modelo: TEO_MODELO,
  embedModelo: TEO_EMBED,
  trainerKey: TEO_TRAINER_KEY,
  trainerModel: TEO_TRAINER_MODEL,
  trainerUrl: TEO_TRAINER_URL,
  ollamaUrl: OLLAMA_URL,
  porta: TEO_PORTA,
  ollamaApiKey: process.env.OLLAMA_API_KEY ?? null,
  agenteCodigoModel: AGENTE_CODIGO_MODEL,
} as const

// ── Healthcheck do Ollama ─────────────────────────────────────

export async function verificarOllama(): Promise<boolean> {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, {
      timeout: 5000,
    })
    return res.status === 200
  } catch {
    return false
  }
}

// ── Graceful shutdown ─────────────────────────────────────────

type ShutdownFn = () => void | Promise<void>
const hooks: ShutdownFn[] = []

export function onShutdown(fn: ShutdownFn): void {
  hooks.push(fn)
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} — encerrando TEO...`)
  for (const fn of hooks) {
    try {
      await fn()
    } catch {
      /* ignore */
    }
  }
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err.message)
  shutdown('uncaughtException')
})

// ── Boot ──────────────────────────────────────────────────────

export function estaNoTerminal(): boolean {
  return process.stdout.isTTY === true
}

export async function boot(): Promise<void> {
  const ollamaOk = await verificarOllama()
  if (!ollamaOk) {
    console.warn(
      `⚠ Ollama não respondeu em ${OLLAMA_URL} — o sistema pode não funcionar`
    )
  }

  if (estaNoTerminal()) {
    const { printStart } = await import('./terminal/ui.js')
    printStart(TEO.porta)
  }
}
