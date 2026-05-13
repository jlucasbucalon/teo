// ============================================================
//  TEO — src/ui/terminal.ts
//  Controle central de toda saída visual do terminal
//  Nenhum outro arquivo deve usar console.log diretamente
// ============================================================

// ── Cores ANSI ───────────────────────────────────────────────

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const CYAN = '\x1b[36m'
const CYAN_B = '\x1b[1;36m'
const GREEN = '\x1b[32m'
const GREEN_B = '\x1b[1;32m'
const YELLOW = '\x1b[33m'
const MAGENTA = '\x1b[35m'
const RED = '\x1b[31m'
const GREY = '\x1b[90m'
const WHITE = '\x1b[97m'
const BG_DARK = '\x1b[40m'

// ── Helpers ──────────────────────────────────────────────────

function linha(char = '─', tamanho = 52): string {
  return GREY + char.repeat(tamanho) + RESET
}

function corModelo(modelo = ''): string {
  const m = modelo.toLowerCase()
  if (m.includes('qwen')) return CYAN
  if (m.includes('llama')) return MAGENTA
  if (m.includes('gemma')) return YELLOW
  if (m.includes('mistral')) return GREEN
  return CYAN
}

function centralizar(str: string, largura: number): string {
  const pad = Math.max(
    0,
    Math.floor((largura - 2 - str.length) / 2)
  )
  return (
    ' '.repeat(pad) +
    str +
    ' '.repeat(Math.max(0, largura - 2 - pad - str.length))
  )
}

// ── Boot ─────────────────────────────────────────────────────

export function printStart(porta: number): void {
  const W = 52
  const titulo =
    'TEO  —  Tecnologia de Execução Orquestrada'
  const subtitulo = `porta ${porta}  |  ollama  |  online`
  const dica = 'teo ajuda  para ver os comandos disponíveis'

  const borda = (l: string, r: string, fill: string) =>
    CYAN + l + fill.repeat(W - 2) + r + RESET

  console.clear()
  console.log('')
  console.log(borda('╔', '╗', '═'))
  console.log(
    CYAN +
      '║' +
      RESET +
      ' '.repeat(W - 2) +
      CYAN +
      '║' +
      RESET
  )
  console.log(
    CYAN +
      '║' +
      RESET +
      CYAN_B +
      centralizar(titulo, W) +
      RESET +
      CYAN +
      '║' +
      RESET
  )
  console.log(
    CYAN +
      '║' +
      RESET +
      GREY +
      centralizar(subtitulo, W) +
      RESET +
      CYAN +
      '║' +
      RESET
  )
  console.log(
    CYAN +
      '║' +
      RESET +
      ' '.repeat(W - 2) +
      CYAN +
      '║' +
      RESET
  )
  console.log(borda('╚', '╝', '═'))
  console.log(GREY + '  › ' + DIM + dica + RESET + '\n')
}

// ── Hardware ─────────────────────────────────────────────────

export function printHardware(relatorio: string): void {
  console.log(linha())
  console.log(CYAN_B + '  Hardware detectado:' + RESET)
  relatorio
    .split('\n')
    .forEach((l) => console.log(GREY + '  ' + l + RESET))
  console.log(linha() + '\n')
}

// ── Servidor ─────────────────────────────────────────────────

export function printServidor(porta: number): void {
  console.log(
    GREY +
      '  › ' +
      GREEN +
      'servidor' +
      RESET +
      GREY +
      ' rodando em ' +
      RESET +
      CYAN_B +
      `http://localhost:${porta}` +
      RESET +
      '\n'
  )
}

// ── Prompt do CLI ────────────────────────────────────────────

export function formatPrompt(chatAtual?: string | null): string {
  const chat = chatAtual ? `${CYAN}${chatAtual}${RESET} ` : ''
  return `${GREY}user${RESET} ${chat}${GREY}›${RESET} `
}

// ── Streaming: header e footer separados ────────────────────
// Usados quando a resposta chega em tokens (stream: true).
// printStreamHeader abre o bloco e deixa o cursor posicionado.
// printStreamEnd fecha com o tempo total.

export function printStreamHeader(
  modelo: string,
  modo: 'local' | 'online'
): void {
  const isOnline = modo === 'online'
  const cor = isOnline ? corModelo(modelo) : GREY

  const tag = isOnline
    ? BG_DARK + BOLD + cor + ' TEO ' + RESET
    : GREY + ' TEO ' + RESET
  const modTag = cor + modelo + RESET
  const modoTag = isOnline
    ? MAGENTA + BOLD + 'online' + RESET
    : GREY + 'local' + RESET

  console.log('')
  console.log(linha())
  console.log(tag + '  ' + modTag + '  ' + modoTag)
  console.log(linha())
  process.stdout.write(WHITE) // inicia texto branco sem nova linha
}

export function printStreamEnd(durationMs: number): void {
  process.stdout.write(RESET + '\n')
  const timeStr = `${(durationMs / 1000).toFixed(2)}s`
  const W = 52
  const sep = '─'
  const label = ` ${timeStr} `
  const left = Math.floor((W - label.length) / 2)
  const right = W - left - label.length
  console.log(GREY + sep.repeat(left) + label + sep.repeat(right) + RESET + '\n')
}

// ── Resposta do TEO ──────────────────────────────────────────

export interface ResponseOptions {
  texto: string
  modelo?: string
  durationMs?: number
  modo?: 'local' | 'online' | 'cmd'
}

export function printResponse(opts: ResponseOptions): void {
  const {
    texto,
    modelo = 'TEO-core',
    durationMs,
    modo = 'local',
  } = opts
  const isCmd = modo === 'cmd'
  const isOnline = modo === 'online'

  if (isCmd) {
    const timeStr =
      durationMs != null
        ? GREY +
          `${(durationMs / 1000).toFixed(2)}s` +
          RESET
        : ''
    const tag =
      BG_DARK +
      GREEN_B +
      ' TEO ' +
      RESET +
      ' ' +
      GREEN +
      'cmd' +
      RESET

    console.log('')
    console.log(linha())
    console.log(tag + '  ' + timeStr)
    console.log(linha())
    console.log(GREEN + texto + RESET)
    console.log(linha() + '\n')
  } else if (isOnline) {
    const cor = corModelo(modelo)
    const timeStr =
      durationMs != null
        ? cor + `${(durationMs / 1000).toFixed(2)}s` + RESET
        : ''
    const tag = BG_DARK + BOLD + cor + ' TEO ' + RESET
    const modTag = cor + modelo + RESET
    const modoTag = MAGENTA + BOLD + 'online' + RESET

    console.log('')
    console.log(linha())
    console.log(tag + '  ' + modTag + '  ' + modoTag + '  ' + timeStr)
    console.log(linha())
    console.log(WHITE + texto + RESET)
    console.log(linha() + '\n')
  } else {
    const tag = GREY + ' TEO ' + RESET
    const modTag = GREY + modelo + RESET
    const modoTag = GREY + 'local' + RESET
    const timeStr =
      durationMs != null
        ? GREY + `${(durationMs / 1000).toFixed(2)}s` + RESET
        : ''

    console.log('')
    console.log(linha())
    console.log(tag + '  ' + modTag + '  ' + modoTag + '  ' + timeStr)
    console.log(linha())
    console.log(WHITE + texto + RESET)
    console.log(linha() + '\n')
  }
}

// ── Erro ─────────────────────────────────────────────────────

export function printError(msg = 'erro interno'): void {
  const tag =
    BG_DARK +
    RED +
    BOLD +
    ' TEO ' +
    RESET +
    ' ' +
    RED +
    'erro' +
    RESET

  console.log('')
  console.log(linha())
  console.log(tag)
  console.log(linha())
  console.log(RED + msg + RESET)
  console.log(linha() + '\n')
}

// ── Ajuda / Menu de comandos ─────────────────────────────────

export interface ComandoExibido {
  comando: string
  descricao: string
  variacoes: string[]
}

export function printAjuda(
  comandos: ComandoExibido[]
): void {
  console.log('')
  console.log(linha())
  console.log(CYAN_B + '  Comandos disponíveis:' + RESET)
  console.log(linha())
  for (const c of comandos) {
    const cmd = CYAN + c.comando.padEnd(22) + RESET
    const desc = WHITE + c.descricao + RESET
    const vars =
      c.variacoes.length > 0
        ? GREY +
          '  (' +
          c.variacoes.join(', ') +
          ')' +
          RESET
        : ''
    console.log('  ' + cmd + desc + vars)
  }
  console.log(linha() + '\n')
}

// ── Info / Aviso ─────────────────────────────────────────────

export function printInfo(msg: string): void {
  console.log(GREY + '  › ' + YELLOW + msg + RESET)
}

// ── Troca de modo ────────────────────────────────────────────

export function printModo(modo: string): void {
  const isOnline = modo === 'online'
  const cor = isOnline ? MAGENTA : CYAN
  const label = isOnline ? 'online' : 'local'
  const desc = isOnline
    ? 'raciocínio completo, sem limite de tokens'
    : 'respostas diretas, contexto reduzido'

  console.log('')
  console.log(linha())
  console.log(
    GREY +
      '  › ' +
      RESET +
      cor +
      BOLD +
      `modo ${label}` +
      RESET +
      GREY +
      `  —  ${desc}` +
      RESET
  )
  console.log(linha() + '\n')
}

// ── Memória limpa ────────────────────────────────────────────

export function printReset(): void {
  console.log(
    GREY + '\n  › ' + CYAN + 'memória limpa.' + RESET + '\n'
  )
}

// ── Encerramento ─────────────────────────────────────────────

export function printExit(): void {
  console.log(
    GREY + '\n  › ' + DIM + 'até logo.' + RESET + '\n'
  )
}

// ── Spinner ──────────────────────────────────────────────────

const FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
]

let _spinnerTimer: ReturnType<typeof setInterval> | null = null
let _spinnerLabel = ''

export function startSpinner(modelo = '...'): void {
  if (_spinnerTimer) stopSpinner()
  _spinnerLabel = `pensando  [${modelo}]`

  let i = 0
  _spinnerTimer = setInterval(() => {
    const frame = CYAN + FRAMES[i % FRAMES.length] + RESET
    process.stdout.write(`\r${frame} ${DIM}${_spinnerLabel}${RESET}`)
    i++
  }, 80)
}

export function updateSpinner(label: string): void {
  _spinnerLabel = label
}

export function stopSpinner(): void {
  if (!_spinnerTimer) return
  clearInterval(_spinnerTimer)
  process.stdout.write('\r\x1b[2K')
  _spinnerTimer = null
}

// ── Etapas do agente de programação ─────────────────────────

import type { EtapaAgente } from '../agents/agenteProgramacao'

export function printClassificacao(
  nicho: string,
  agente?: string
): void {
  console.log(GREY + '  › ' + DIM + `nicho: ${nicho}` + RESET)
  if (agente) {
    console.log(GREY + '  › ' + DIM + `agente: ${agente}` + RESET)
  }
}

export function spinnerEtapa(
  etapa: EtapaAgente,
  modelo: string
): void {
  switch (etapa.tipo) {
    case 'lendo_conhecimento':
      process.stdout.write('\r\x1b[2K')
      console.log(GREY + '  › ' + CYAN + `consultando conhecimento (${etapa.nicho}.md)` + RESET)
      startSpinner(modelo)
      break
    case 'buscando_web':
      process.stdout.write('\r\x1b[2K')
      console.log(
        GREY + '  › ' + CYAN +
        `buscando na web: "${etapa.query.slice(0, 45)}"` +
        RESET
      )
      startSpinner(modelo)
      break
    case 'pensando':
      updateSpinner(`[${modelo}] pensando...`)
      break
    case 'respondendo':
      updateSpinner(`[${modelo}] respondendo...`)
      break
  }
}
