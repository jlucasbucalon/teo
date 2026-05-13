// ============================================================
//  TEO — src/tools/escreverVector.ts
//  Ferramenta de escrita dos arquivos .md do trainer.
//  Usada exclusivamente pelo agenteTrainer.ts.
//  Sem lógica de IA — apenas filesystem.
// ============================================================

import fs from 'fs'
import path from 'path'
import { invalidarCache } from './lerVector'

// ── Paths ─────────────────────────────────────────────────────

const BASE = path.resolve(
  __dirname,
  '../../src/memory/trainer'
)

const PATHS = {
  nichos: path.join(BASE, 'nichos'),
  tarefas: path.join(BASE, 'tarefas'),
  agentes: path.join(BASE, 'agentes'),
} as const

type TipoVector = keyof typeof PATHS

// ── Helpers ───────────────────────────────────────────────────

/**
 * Atualiza o campo "última atualização:" no .md com o timestamp atual.
 * Mantém o conteúdo intacto — só troca a linha de data.
 * Se o campo não existir, não faz nada.
 */
function injetarTimestamp(conteudo: string): string {
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // Substitui "última atualização: <qualquer coisa>" pelo timestamp atual
  const atualizado = conteudo.replace(
    /^última atualização:.*$/m,
    `última atualização: ${agora}`
  )

  return atualizado
}

// ── Core ──────────────────────────────────────────────────────

function escrever(
  tipo: TipoVector,
  id: string,
  conteudo: string
): void {
  try {
    const dir = PATHS[tipo]

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Injeta timestamp antes de salvar
    const conteudoFinal = injetarTimestamp(conteudo)

    fs.writeFileSync(
      path.join(dir, `${id}.md`),
      conteudoFinal,
      'utf8'
    )

    // Invalida o cache do lerVector — força releitura na próxima consulta
    invalidarCache(id)
  } catch {
    // Falha silenciosa — o trainer nunca interrompe o usuário
  }
}

// ── API pública ───────────────────────────────────────────────

export function escreverNicho(
  nicho: string,
  conteudo: string
): void {
  escrever('nichos', nicho, conteudo)
}

export function escreverTarefa(
  tarefa: string,
  conteudo: string
): void {
  escrever('tarefas', tarefa, conteudo)
}

export function escreverAgente(
  agente: string,
  conteudo: string
): void {
  escrever('agentes', agente, conteudo)
}
