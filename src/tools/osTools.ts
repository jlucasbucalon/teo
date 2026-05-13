// ============================================================
//  TEO — src/tools/osTools.ts
//  Ferramentas nativas do sistema operacional
//  TEO usa estas para interagir com o mundo real
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface FileInfo {
  path: string
  nome: string
  tamanho: number
  modificado: string
  tipo: 'arquivo' | 'diretorio'
}

export interface VariavelAmbiente {
  nome: string
  valor: string
}

// ── Sistema de arquivos ─────────────────────────────────────

export function lerArquivo(caminho: string): string | null {
  try {
    if (!fs.existsSync(caminho)) return null
    return fs.readFileSync(caminho, 'utf-8')
  } catch {
    return null
  }
}

export function escreverArquivo(
  caminho: string,
  conteudo: string
): boolean {
  try {
    const dir = path.dirname(caminho)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(caminho, conteudo, 'utf-8')
    return true
  } catch {
    return false
  }
}

export function listarDiretorio(
  caminho: string
): FileInfo[] {
  try {
    if (!fs.existsSync(caminho)) return []
    return fs.readdirSync(caminho).map((nome) => {
      const full = path.join(caminho, nome)
      const stat = fs.statSync(full)
      return {
        path: full,
        nome,
        tamanho: stat.size,
        modificado: stat.mtime.toISOString(),
        tipo: stat.isDirectory() ? 'diretorio' : 'arquivo',
      }
    })
  } catch {
    return []
  }
}

export function arquivoExiste(caminho: string): boolean {
  return fs.existsSync(caminho)
}

export function criarDiretorio(caminho: string): boolean {
  try {
    fs.mkdirSync(caminho, { recursive: true })
    return true
  } catch {
    return false
  }
}

export function deletarArquivo(caminho: string): boolean {
  try {
    fs.unlinkSync(caminho)
    return true
  } catch {
    return false
  }
}

// ── Variáveis de ambiente ────────────────────────────────────

export function getVariaveisAmbiente(): VariavelAmbiente[] {
  return Object.entries(process.env).map(
    ([nome, valor]) => ({
      nome,
      valor: valor ?? '',
    })
  )
}

export function getVariavel(nome: string): string | null {
  return process.env[nome] ?? null
}

// ── Info do sistema ─────────────────────────────────────────

export function getSystemInfo(): {
  plataforma: string
  arch: string
  home: string
  cpuCores: number
  memoriaTotal: number
  hostname: string
  nodeVersion: string
} {
  return {
    plataforma: os.platform(),
    arch: os.arch(),
    home: os.homedir(),
    cpuCores: os.cpus().length,
    memoriaTotal: os.totalmem(),
    hostname: os.hostname(),
    nodeVersion: process.version,
  }
}

// ── Path do projeto ─────────────────────────────────────────

export function getProjectRoot(): string {
  return path.resolve(__dirname, '../..')
}

export function getMemoryDir(): string {
  return path.resolve(__dirname, '../../memory')
}

export function getSrcDir(): string {
  return path.resolve(__dirname, '../..')
}

// ── Formatação para contexto do agente ─────────────────────

export function formatarFileInfo(
  files: FileInfo[]
): string {
  if (files.length === 0)
    return 'Diretório vazio ou inexistente'
  return files
    .map((f) => {
      const size =
        f.tipo === 'diretorio'
          ? '📁'
          : `${formatarTamanho(f.tamanho)}`
      const mod = new Date(f.modificado).toLocaleString(
        'pt-BR'
      )
      return `  ${size} ${f.nome} — ${mod}`
    })
    .join('\n')
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

export function formatarSystemInfo(): string {
  const info = getSystemInfo()
  return `## Sistema Operacional
Plataforma: ${info.plataforma} (${info.arch})
Hostname: ${info.hostname}
CPU cores: ${info.cpuCores}
RAM total: ${(info.memoriaTotal / 1024 ** 3).toFixed(1)}GB
Node: ${info.nodeVersion}
Raiz do projeto: ${getProjectRoot()}`
}
