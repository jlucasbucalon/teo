// ============================================================
//  TEO — src/core/nichos.ts
//  Carrega e disponibiliza os nichos definidos em src/nichos/*.json
//
//  Cache em memória — lê o disco só na primeira chamada.
//  Garante automaticamente o .md do trainer para cada nicho.
// ============================================================

import fs from 'fs'
import path from 'path'

const NICHOS_DIR = path.resolve(__dirname, '../../src/codex/nichos')
const TRAINER_DIR = path.resolve(
  __dirname,
  '../../src/memory/trainer/nichos'
)

export interface NichoConfig {
  id: string
  label: string
  description: string
  keywords: string[]
  related: string[]
}

let _cache: NichoConfig[] | null = null

// ── Template do .md de conhecimento ─────────────────────────

function templateMd(nicho: NichoConfig): string {
  return [
    `# Conhecimento — ${nicho.label}`,
    `última atualização: —`,
    ``,
    `## Conceitos e fundamentos`,
    `_sem dados ainda_`,
    ``,
    `## Boas práticas`,
    `_sem dados ainda_`,
    ``,
    `## Dicas e referências`,
    `_sem dados ainda_`,
    ``,
    `## Padrões e observações`,
    `_sem dados ainda_`,
  ].join('\n')
}

// ── Garante .md do trainer para o nicho ─────────────────────
// Cria se não existir, ou sobrescreve se ainda for placeholder antigo.

function garantirMdTrainer(nicho: NichoConfig): void {
  if (!fs.existsSync(TRAINER_DIR)) {
    fs.mkdirSync(TRAINER_DIR, { recursive: true })
  }
  const file = path.join(TRAINER_DIR, `${nicho.id}.md`)

  const estaVazio =
    !fs.existsSync(file) ||
    fs.readFileSync(file, 'utf8').includes('_ainda sem dados_')

  if (estaVazio) {
    fs.writeFileSync(file, templateMd(nicho), 'utf8')
  }
}

// ── API pública ──────────────────────────────────────────────

export function carregarNichos(): NichoConfig[] {
  if (_cache !== null) return _cache

  if (!fs.existsSync(NICHOS_DIR)) {
    _cache = []
    return _cache
  }

  const arquivos = fs
    .readdirSync(NICHOS_DIR)
    .filter((f) => f.endsWith('.json'))

  _cache = arquivos.map((arquivo) => {
    const raw = fs.readFileSync(
      path.join(NICHOS_DIR, arquivo),
      'utf8'
    )
    return JSON.parse(raw) as NichoConfig
  })

  for (const nicho of _cache) {
    garantirMdTrainer(nicho)
  }

  return _cache
}

export function getNicho(id: string): NichoConfig | null {
  return carregarNichos().find((n) => n.id === id) ?? null
}

export function listarIds(): string[] {
  return carregarNichos().map((n) => n.id)
}
