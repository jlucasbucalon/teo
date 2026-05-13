import express, { Request, Response } from 'express'
import cors from 'cors'
import { TEO } from '../aios'
import { teoChat } from '../teo'
import type { OpenAIMessage } from '../core/types'

// ── Tipos ────────────────────────────────────────────────────

interface ChatRequest {
  messages: OpenAIMessage[]
  stream?: boolean
  chatId?: string
}

// ── Servidor ─────────────────────────────────────────────────

export function createServer() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // ── Health check ─────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', modelo: TEO.modelo })
  })

  // ── Chat handler ─────────────────────────────────────────
  const chatHandler = async (
    req: Request<object, object, ChatRequest>,
    res: Response
  ) => {
    const { messages, chatId } = req.body

    // Validação
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        error: 'messages deve ser um array não vazio',
      })
      return
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const chunkBase = {
      id: `chatcmpl-teo-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: TEO.modelo,
    }

    // início do stream (role)
    res.write(
      `data: ${JSON.stringify({
        ...chunkBase,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          },
        ],
      })}\n\n`
    )

    try {
      // ── CORE ÚNICO (TEO BRAIN) — streaming real ────────────
      await teoChat(
        messages,
        (token) => {
          res.write(
            `data: ${JSON.stringify({
              ...chunkBase,
              choices: [
                {
                  index: 0,
                  delta: { content: token },
                  finish_reason: null,
                },
              ],
            })}\n\n`
          )
        },
        chatId ?? null
      )

      // fim
      res.write(
        `data: ${JSON.stringify({
          ...chunkBase,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        })}\n\n`
      )

      res.write('data: [DONE]\n\n')
      res.end()
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido'

      console.error('TEO ERROR:', msg)

      res.write(
        `data: ${JSON.stringify({
          ...chunkBase,
          choices: [
            {
              index: 0,
              delta: { content: `\n\n[Erro: ${msg}]` },
              finish_reason: 'stop',
            },
          ],
        })}\n\n`
      )

      res.write('data: [DONE]\n\n')
      res.end()
    }
  }

  // Rotas compatíveis com OpenAI
  app.post('/v1/chat/completions', chatHandler)
  app.post('/chat/completions', chatHandler)

  return app
}
