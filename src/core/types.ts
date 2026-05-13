// ============================================================
//  TEO — types.ts
//  Tipos compartilhados do core
//  Não importa nada — zero dependências
// ============================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  embed?: number[]
}

export type Modo = 'local' | 'online'
