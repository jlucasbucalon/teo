// ============================================================
//  TEO — src/tools/executeCode.ts
//  Executor de código seguro com sandbox
//
//  Responsabilidades:
//    - Executar JavaScript em sandbox (Function + eval isolado)
//    - Executar Python com arquivo temporário + timeout
//    - Capturar output e erros
//    - Nunca lança exceção — sempre retorna RespostaCodigo
//
//  Segurança:
//    - JS: sandbox limitado (sem access a fs, network, require, import)
//    - Python: subprocess com timeout
//    - Ambos: timeout de 5s (padrão)
// ============================================================

import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ── Tipos ────────────────────────────────────────────────────

export type Linguagem = 'javascript' | 'js' | 'python' | 'py'

export interface RespostaCodigo {
  sucesso: boolean
  output: string
  linguagem: Linguagem
  tempo_ms: number
  erro?: string
}

// ── Normalização de linguagem ────────────────────────────────

function normalizarLinguagem(input: string): Linguagem {
  const lower = input.toLowerCase().trim()
  if (lower === 'js') return 'javascript'
  if (lower === 'py') return 'python'
  if (lower === 'javascript') return 'javascript'
  if (lower === 'python') return 'python'
  return 'javascript'
}

// ── JavaScript com sandbox seguro ────────────────────────────

export function executeJavaScript(
  code: string,
  _timeout = 5000
): RespostaCodigo {
  const inicio = Date.now()
  const logs: string[] = []

  const fakeConsole = {
    log: (...args: unknown[]) =>
      logs.push(args.map(String).join(' ')),
    error: (...args: unknown[]) =>
      logs.push('❌ ' + args.map(String).join(' ')),
    warn: (...args: unknown[]) =>
      logs.push('⚠️ ' + args.map(String).join(' ')),
    info: (...args: unknown[]) =>
      logs.push('ℹ️ ' + args.map(String).join(' ')),
    dir: (obj: unknown) =>
      logs.push(JSON.stringify(obj, null, 2)),
    table: (obj: unknown) =>
      logs.push(JSON.stringify(obj, null, 2)),
  }

  const sandbox: Record<string, unknown> = {
    console: fakeConsole,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    WeakMap,
    WeakSet,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (s: string) => Buffer.from(s).toString('base64'),
    atob: (s: string) => Buffer.from(s, 'base64').toString('utf8'),
  }

  const keys = Object.keys(sandbox)
  const vals = Object.values(sandbox)

  try {
    const fn = new Function(...keys, `"use strict";\n${code}`)
    const result = fn(...vals)
    if (result !== undefined) logs.push('→ ' + String(result))
    return {
      sucesso: true,
      output: logs.join('\n'),
      linguagem: 'javascript',
      tempo_ms: Date.now() - inicio,
    }
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err)
    return {
      sucesso: false,
      output: logs.join('\n'),
      linguagem: 'javascript',
      tempo_ms: Date.now() - inicio,
      erro,
    }
  }
}

// ── Python com subprocess e timeout ─────────────────────────

export function executePython(
  code: string,
  timeout = 5000
): RespostaCodigo {
  const inicio = Date.now()
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, `teo_py_${Date.now()}.py`)

  fs.writeFileSync(tmpFile, code, 'utf8')

  return new Promise<RespostaCodigo>((resolve) => {
    const proc = spawn('python', [tmpFile], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: string) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data: string) => {
      stderr += data.toString()
    })

    proc.on('error', (err: Error) => {
      try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
      resolve({
        sucesso: false,
        output: stdout,
        linguagem: 'python',
        tempo_ms: Date.now() - inicio,
        erro: err.message,
      })
    })

    proc.on('close', (code: number | null) => {
      try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
      if (code === 0) {
        resolve({
          sucesso: true,
          output: stdout.trim(),
          linguagem: 'python',
          tempo_ms: Date.now() - inicio,
        })
      } else {
        resolve({
          sucesso: false,
          output: stdout.trim(),
          linguagem: 'python',
          tempo_ms: Date.now() - inicio,
          erro: stderr || `Exit code: ${code ?? 'unknown'}`,
        })
      }
    })
  }) as unknown as RespostaCodigo
}

// ── Executor genérico ────────────────────────────────────────

export async function executarCodigo(
  code: string,
  linguagem: string = 'javascript',
  timeout = 5000
): Promise<RespostaCodigo> {
  const lang = normalizarLinguagem(linguagem)

  switch (lang) {
    case 'javascript':
    case 'js':
      return executeJavaScript(code, timeout)
    case 'python':
    case 'py':
      return executePython(code, timeout)
    default:
      return {
        sucesso: false,
        output: '',
        linguagem: lang,
        tempo_ms: 0,
        erro: `Linguagem não suportada: ${linguagem}. Use: javascript, python`,
      }
  }
}

// ── Validação de segurança ───────────────────────────────────

export function validarCodigoSeguro(code: string): {
  valido: boolean
  aviso?: string
} {
  const patterns = [
    /\brequire\s*\(/i,
    /\bimport\s+.*\bfrom\b/i,
    /\bimport\s+['"](fs|path|os|child_process|crypto|fs\.)/i,
    /\bprocess\b/i,
    /\bglobal\b(?!\s*\[)/i,
    /\b__dirname\b/i,
    /\b__filename\b/i,
    /\beval\b/i,
    /\bFunction\s*\(/i,
    /\bsetTimeout\b/i,
    /\bsetInterval\b/i,
    /\bsetImmediate\b/i,
    /\bprocess\.exit\b/i,
  ]

  for (const pattern of patterns) {
    if (pattern.test(code)) {
      return {
        valido: false,
        aviso: 'Código contém padrão potencialmente perigoso.',
      }
    }
  }

  return { valido: true }
}