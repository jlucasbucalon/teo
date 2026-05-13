// ============================================================
//  TEO — src/memory/userProfile.ts
//  Perfil persistente do usuário — aprendido ao longo do tempo
//  TEO é responsavel por atualizar e manter este arquivo
// ============================================================

import * as fs from 'fs'
import * as path from 'path'

export interface UserProfile {
  nome: string | null
  cidade: string | null
  estado: string | null
  pais: string | null
  ip: string | null
  timezone: string | null
  primeiraInteracao: string | null
  ultimaInteracao: string | null
  totalChats: number
  idiomaPreferido: string
  modeloPrincipal: string | null
  preferencias: {
    modoDefault: 'local' | 'online'
    buscaAutomatica: boolean
    climaAtivado: boolean
  }
  interesses: string[]
  notas: string
}

const PROFILE_PATH = path.resolve(
  __dirname,
  '../../memory/userProfile.json'
)

const DEFAULT_PROFILE: UserProfile = {
  nome: null,
  cidade: null,
  estado: null,
  pais: null,
  ip: null,
  timezone: null,
  primeiraInteracao: null,
  ultimaInteracao: null,
  totalChats: 0,
  idiomaPreferido: 'pt-BR',
  modeloPrincipal: null,
  preferencias: {
    modoDefault: 'local',
    buscaAutomatica: true,
    climaAtivado: true,
  },
  interesses: [],
  notas: '',
}

export function carregarPerfil(): UserProfile {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const raw = fs.readFileSync(PROFILE_PATH, 'utf-8')
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PROFILE }
}

export function salvarPerfil(perfil: UserProfile): void {
  try {
    const dir = path.dirname(PROFILE_PATH)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      PROFILE_PATH,
      JSON.stringify(perfil, null, 2)
    )
  } catch (err) {
    console.error('Erro ao salvar perfil:', err)
  }
}

export function atualizarPerfilGeo(
  cidade: string,
  estado: string,
  pais: string,
  ip: string,
  timezone: string
): void {
  const perfil = carregarPerfil()
  perfil.cidade = cidade
  perfil.estado = estado
  perfil.pais = pais
  perfil.ip = ip
  perfil.timezone = timezone
  salvarPerfil(perfil)
}

export function atualizarPerfilInteracao(
  nome?: string,
  interesses?: string[]
): void {
  const perfil = carregarPerfil()
  if (nome && !perfil.nome) perfil.nome = nome
  if (interesses) {
    interesses.forEach((i: string) => {
      if (!perfil.interesses.includes(i))
        perfil.interesses.push(i)
    })
  }
  perfil.ultimaInteracao = new Date().toISOString()
  if (!perfil.primeiraInteracao)
    perfil.primeiraInteracao = perfil.ultimaInteracao
  salvarPerfil(perfil)
}

export function incrementarChats(): void {
  const perfil = carregarPerfil()
  perfil.totalChats++
  salvarPerfil(perfil)
}

export function formatarPerfil(): string {
  const p = carregarPerfil()
  const partes: string[] = []

  partes.push(`## Perfil do Usuário`)
  if (p.nome) partes.push(`Nome: ${p.nome}`)
  if (p.cidade)
    partes.push(
      `Localização: ${p.cidade}, ${p.estado}, ${p.pais}`
    )
  partes.push(`Timezone: ${p.timezone ?? 'desconhecido'}`)
  partes.push(`Chats: ${p.totalChats}`)
  partes.push(
    `Última interação: ${p.ultimaInteracao ? new Date(p.ultimaInteracao).toLocaleString('pt-BR') : 'nenhuma'}`
  )
  if (p.interesses.length > 0)
    partes.push(`Interesses: ${p.interesses.join(', ')}`)
  if (p.preferencias.modoDefault)
    partes.push(
      `Modo preferido: ${p.preferencias.modoDefault}`
    )

  return partes.join('\n')
}