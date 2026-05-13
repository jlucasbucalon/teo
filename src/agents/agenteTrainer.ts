// ============================================================
//  TEO — src/agents/agenteTrainer.ts
//  Agente de treinamento — enriquece os .md dos nichos após
//  cada interação via tool calling (Anthropic/Ollama) ou
//  prompt único (Gemini).
//
//  Melhorias:
//    - Prompt genérico para qualquer nicho
//    - Avaliação da qualidade da resposta do TEO
//    - Identificação de gaps no .md
//    - Subseções dinâmicas por assunto
//    - Log do trainer (sucesso, sem alteração, erro)
//    - Resposta completa sem truncamento
//    - Fire-and-forget — nunca bloqueia o usuário
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { TEO } from '../aios'
import { buscaWeb } from '../tools/buscaWeb'
import { lerNicho } from '../tools/lerVector'
import { escreverNicho } from '../tools/escreverVector'
import { SYSTEM_PROMPT as SISTEMA_TEO } from '../codex/prompt'

// ── Tipos ────────────────────────────────────────────────────

export interface TreinamentoParams {
  nicho: string
  topico: string
  input: string
  resposta: string
  chatId: string | null
}

export interface ResultadoTreinamento {
  ok: boolean
  nicho: string
  atualizado: boolean
  erro?: string
}

// ── Log do trainer ────────────────────────────────────────────

const LOG_DIR = path.resolve(__dirname, '../../src/memory')
const LOG_FILE = path.join(LOG_DIR, 'trainer.log')

function logTrainer(
  nicho: string,
  status: 'atualizado' | 'sem_alteracao' | 'erro',
  detalhe?: string
): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
    const timestamp = new Date().toLocaleString('pt-BR')
    const linha = `[${timestamp}] [${nicho}] ${status}${detalhe ? ` — ${detalhe}` : ''}\n`
    fs.appendFileSync(LOG_FILE, linha, 'utf8')
  } catch {
    // Log silencioso — nunca interrompe o trainer
  }
}

// ── System prompt ────────────────────────────────────────────

const UNIVERSAL_TEO = SISTEMA_TEO.content

const TRAINER_PROMPT = `Você é o TEO Trainer — sua função é enriquecer o conhecimento do TEO sobre nichos específicos.

Você recebe uma interação do chat, o nicho identificado e o conteúdo atual do arquivo de conhecimento.
Seu trabalho é analisar, avaliar e decidir se há algo genuinamente novo para adicionar.

PROCESSO OBRIGATÓRIO:
1. Leia o conteúdo atual do nicho (fornecido abaixo)
2. Avalie a resposta do TEO: estava correta e completa? Se não, identifique o que precisa ser corrigido
3. Identifique gaps: o que foi perguntado que NÃO está no .md ainda?
4. Se há conhecimento novo ou correção necessária → atualize o .md
5. Se o conteúdo já existe e está correto → retorne SEM_ALTERACAO

REGRAS DE ESCRITA:
- Escreva sobre o ASSUNTO/NICHO — nunca sobre o usuário
- Crie subseções específicas por assunto dentro do nicho:
  Exemplo: "## Node.js — Criação de servidores HTTP"
  Exemplo: "## Diabetes — Sintomas e diagnóstico"
  Exemplo: "## Marketing Digital — SEO on-page"
- Adicione apenas conhecimento técnico, preciso e verificável
- Preserve TODO o conteúdo já existente no .md
- Não repita informações que já estão no arquivo
- Corrija informações incorretas se identificar
- Seja objetivo e técnico — sem opiniões ou suposições

FORMATO DA RESPOSTA:
- Se há alteração: retorne o arquivo .md COMPLETO e atualizado
- Se não há nada novo: retorne exatamente a string SEM_ALTERACAO
- Nunca retorne explicações, comentários ou markdown extra além do .md`

const SYSTEM_PROMPT =
  UNIVERSAL_TEO + '\n\n' + TRAINER_PROMPT

// ── Ferramentas (Anthropic/Ollama) ────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'buscar_web',
    description:
      'Busca informações atuais na internet para verificar, corrigir ou enriquecer o conhecimento do nicho. Use quando identificar gaps ou informações que podem estar desatualizadas.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Termos de busca específicos e relevantes para o assunto',
        },
        max_resultados: {
          type: 'number',
          description: 'Máximo de resultados (padrão 3)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'atualizar_nicho',
    description:
      'Escreve o arquivo .md completo e atualizado com o novo conhecimento. Use apenas se tiver algo genuinamente novo ou uma correção necessária.',
    input_schema: {
      type: 'object',
      properties: {
        nicho: {
          type: 'string',
          description:
            'ID do nicho (ex: programacao, saude, negocios)',
        },
        conteudo: {
          type: 'string',
          description:
            'Conteúdo COMPLETO e atualizado do arquivo .md',
        },
      },
      required: ['nicho', 'conteudo'],
    },
  },
]

// ── Execução de ferramentas ───────────────────────────────────

async function executarFerramenta(
  nome: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (nome) {
      case 'buscar_web': {
        const resultado = await buscaWeb(
          input.query as string,
          (input.max_resultados as number | undefined) ?? 3
        )
        return JSON.stringify(resultado)
      }
      case 'atualizar_nicho': {
        escreverNicho(
          input.nicho as string,
          input.conteudo as string
        )
        return JSON.stringify({ sucesso: true })
      }
      default:
        return JSON.stringify({
          erro: 'Ferramenta desconhecida',
        })
    }
  } catch (err) {
    return JSON.stringify({
      erro:
        err instanceof Error
          ? err.message
          : 'Erro na ferramenta',
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────

function detectarProvider(
  url: string
): 'gemini' | 'anthropic' | 'ollama' {
  if (url.includes('googleapis.com')) return 'gemini'
  if (url.includes('anthropic.com')) return 'anthropic'
  return 'ollama'
}

/**
 * Monta o prompt com contexto completo para o trainer.
 * Inclui o conteúdo atual do .md para o trainer avaliar gaps.
 */
async function montarPrompt(
  params: TreinamentoParams,
  conteudoAtual: string
): Promise<string> {
  return `NICHO: ${params.nicho}
TÓPICO: ${params.topico}
DATA: ${new Date().toLocaleString('pt-BR')}

INTERAÇÃO DO CHAT:
Usuário perguntou: ${params.input}
TEO respondeu: ${params.resposta}

CONTEÚDO ATUAL DO ARQUIVO DE CONHECIMENTO (${params.nicho}.md):
${conteudoAtual || '_arquivo vazio — criar do zero_'}

Analise a interação acima e siga o processo obrigatório descrito.`
}

// ── Loop de tool calling (Anthropic + Ollama) ────────────────

async function runAnthropicLoop(
  client: Anthropic,
  model: string,
  prompt: string,
  nicho: string
): Promise<ResultadoTreinamento> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ]

  let atualizado = false
  const inicio = Date.now()
  const TIMEOUT = 60_000

  while (Date.now() - inicio < TIMEOUT) {
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })

    messages.push({
      role: 'assistant',
      content:
        response.content as Anthropic.MessageParam['content'],
    })

    if (response.stop_reason !== 'tool_use') break

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use'
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUses) {
      const resultado = await executarFerramenta(
        toolUse.name,
        toolUse.input as Record<string, unknown>
      )

      if (toolUse.name === 'atualizar_nicho')
        atualizado = true

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: resultado,
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  if (atualizado) {
    logTrainer(nicho, 'atualizado')
  } else {
    logTrainer(nicho, 'sem_alteracao')
  }

  return { ok: true, nicho, atualizado }
}

// ── Prompt único (Gemini) ────────────────────────────────────

async function runGemini(
  params: TreinamentoParams,
  conteudoAtual: string
): Promise<ResultadoTreinamento> {
  const promptCompleto = await montarPrompt(
    params,
    conteudoAtual
  )

  const prompt = `${SYSTEM_PROMPT}

${promptCompleto}

INSTRUÇÃO FINAL:
- Se há conhecimento novo ou correção: retorne o arquivo .md COMPLETO e atualizado
- Se não há nada novo: retorne exatamente a string SEM_ALTERACAO
- Não inclua explicações, comentários ou texto além do .md`

  const url = `${TEO.trainerUrl}/models/${TEO.trainerModel}:generateContent?key=${TEO.trainerKey}`

  const response = await axios.post(
    url,
    { contents: [{ parts: [{ text: prompt }] }] },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    }
  )

  const resposta: string | undefined =
    response.data?.candidates?.[0]?.content?.parts?.[0]
      ?.text

  if (!resposta) {
    logTrainer(params.nicho, 'erro', 'Gemini sem resposta')
    return {
      ok: true,
      nicho: params.nicho,
      atualizado: false,
    }
  }

  // Gemini retornou SEM_ALTERACAO — não atualiza
  if (resposta.trim() === 'SEM_ALTERACAO') {
    logTrainer(params.nicho, 'sem_alteracao')
    return {
      ok: true,
      nicho: params.nicho,
      atualizado: false,
    }
  }

  // Gemini retornou o .md atualizado
  escreverNicho(params.nicho, resposta.trim())
  logTrainer(params.nicho, 'atualizado')
  return { ok: true, nicho: params.nicho, atualizado: true }
}

// ── API pública ──────────────────────────────────────────────

export async function treinarNicho(
  params: TreinamentoParams
): Promise<ResultadoTreinamento> {
  const { trainerKey, trainerModel, trainerUrl } = TEO

  if (!trainerKey || !trainerModel || !trainerUrl) {
    return {
      ok: false,
      nicho: params.nicho,
      atualizado: false,
      erro: 'Trainer não configurado',
    }
  }

  try {
    // Lê o conteúdo atual do .md — await obrigatório (lerNicho é async)
    const nichoAtual = await lerNicho(params.nicho)
    const conteudoAtual = nichoAtual.conteudo

    const provider = detectarProvider(trainerUrl)

    if (provider === 'gemini') {
      return await runGemini(params, conteudoAtual)
    }

    // Anthropic ou Ollama — usa tool calling
    const client = new Anthropic({
      apiKey: trainerKey,
      ...(provider === 'ollama'
        ? { baseURL: trainerUrl }
        : {}),
    })

    const prompt = await montarPrompt(params, conteudoAtual)
    return await runAnthropicLoop(
      client,
      trainerModel,
      prompt,
      params.nicho
    )
  } catch (err) {
    const erro =
      err instanceof Error
        ? err.message
        : 'Erro desconhecido'
    logTrainer(params.nicho, 'erro', erro)
    return {
      ok: false,
      nicho: params.nicho,
      atualizado: false,
      erro,
    }
  }
}
