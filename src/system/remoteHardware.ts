// ============================================================
//  TEO — src/server/remoteHardware.ts
//  Detecção de hardware da máquina remota executando o Ollama
//
//  O Ollama não expõe hardware diretamente. A detecção usa três
//  camadas em ordem de prioridade:
//
//    1. Variáveis de ambiente (override explícito)
//       OLLAMA_REMOTE_GPU_TYPE  = nvidia | amd | amd-integrated | intel | vulkan | cpu
//       OLLAMA_REMOTE_GPU_VRAM  = GB  (ex: 8)
//       OLLAMA_REMOTE_CPU_CORES = núcleos  (ex: 8)
//       OLLAMA_REMOTE_RAM_GB    = RAM total em GB  (ex: 16)
//
//    2. /api/ps → modelos em execução revelam uso de VRAM
//       size_vram / size ≥ 0.95 → GPU dedicada → 'nvidia'
//       size_vram / size < 0.95 → carregamento misto → 'vulkan'
//       size_vram == 0          → CPU pura
//
//    3. Padrão conservador: 4 núcleos, 8 GB RAM, sem GPU
// ============================================================

import axios from 'axios'
import type {
  CPUInfo,
  RAMInfo,
  GPUInfo,
  GPUTipo,
  OllamaParams,
  CapacidadeInfo,
  HardwareInfo,
} from './hardware'

// ── Tipo estendido com metadados do servidor ─────────────────

export interface HardwareRemotoInfo extends HardwareInfo {
  servidor: string
  versaoOllama: string
}

// ── Constantes (espelho de hardware.ts) ──────────────────────

const LAYERS_MODELO = 33

const MULTIPLICADOR_GPU: Record<GPUTipo, number> = {
  nvidia: 22,
  amd: 18,
  vulkan: 8,
  intel: 5,
  'amd-integrated': 4,
  cpu: 0,
}

// ── Overrides via variáveis de ambiente ──────────────────────

interface EnvOverrides {
  gpuTipo?: GPUTipo
  gpuVramGB?: number
  cpuNucleos?: number
  ramTotalGB?: number
}

function lerEnvOverrides(): EnvOverrides {
  const overrides: EnvOverrides = {}

  const gpuTipoRaw = process.env.OLLAMA_REMOTE_GPU_TYPE
  if (isGPUTipo(gpuTipoRaw)) overrides.gpuTipo = gpuTipoRaw

  const gpuVramRaw = process.env.OLLAMA_REMOTE_GPU_VRAM
  if (gpuVramRaw) overrides.gpuVramGB = parseFloat(gpuVramRaw)

  const coresRaw = process.env.OLLAMA_REMOTE_CPU_CORES
  if (coresRaw) overrides.cpuNucleos = parseInt(coresRaw, 10)

  const ramRaw = process.env.OLLAMA_REMOTE_RAM_GB
  if (ramRaw) overrides.ramTotalGB = parseFloat(ramRaw)

  return overrides
}

function isGPUTipo(value?: string): value is GPUTipo {
  return ['nvidia', 'amd', 'amd-integrated', 'intel', 'vulkan', 'cpu'].includes(
    value ?? ''
  )
}

// ── Query da API do Ollama ───────────────────────────────────

interface ModeloAtivo {
  name: string
  size: number       // bytes — tamanho total do modelo
  size_vram: number  // bytes — porção carregada na GPU
}

async function consultarVersao(baseUrl: string): Promise<string> {
  try {
    const res = await axios.get<{ version?: string }>(
      `${baseUrl}/api/version`,
      { timeout: 5000 }
    )
    return res.data.version ?? 'desconhecida'
  } catch {
    return 'desconhecida'
  }
}

async function consultarModelosAtivos(
  baseUrl: string
): Promise<ModeloAtivo[]> {
  try {
    const res = await axios.get<{ models?: ModeloAtivo[] }>(
      `${baseUrl}/api/ps`,
      { timeout: 5000 }
    )
    return res.data.models ?? []
  } catch {
    return []
  }
}

// ── Inferência de GPU pelos modelos ativos ───────────────────
//
// Ollama não expõe o tipo de GPU — infere-se pelo uso de VRAM:
//   ≥ 95% do modelo na VRAM → GPU dedicada → 'nvidia'
//   1%–94% na VRAM          → carregamento misto → 'vulkan'
//   0% na VRAM              → CPU pura

function inferirGPUDeModelos(modelos: ModeloAtivo[]): {
  tipo: GPUTipo
  vramEmUsoGB: number
} {
  if (modelos.length === 0) return { tipo: 'cpu', vramEmUsoGB: 0 }

  let totalSize = 0
  let totalVram = 0

  for (const m of modelos) {
    totalSize += m.size ?? 0
    totalVram += m.size_vram ?? 0
  }

  if (totalVram === 0) return { tipo: 'cpu', vramEmUsoGB: 0 }

  const fracao = totalSize > 0 ? totalVram / totalSize : 0
  const vramEmUsoGB = totalVram / 1024 ** 3
  const tipo: GPUTipo = fracao >= 0.95 ? 'nvidia' : 'vulkan'

  return { tipo, vramEmUsoGB }
}

// ── Montagem das estruturas de hardware ──────────────────────

function montarCPU(nucleos: number): CPUInfo {
  return {
    nucleos,
    modelo: 'remoto (não detectado)',
    num_thread: nucleos,
  }
}

function montarRAM(totalGB: number): RAMInfo {
  return {
    totalGB,
    livreGB: totalGB * 0.7, // servidor dedicado — estimativa 70% livre
  }
}

function montarGPU(
  inferida: { tipo: GPUTipo; vramEmUsoGB: number },
  overrides: EnvOverrides
): GPUInfo {
  const tipo = overrides.gpuTipo ?? inferida.tipo
  const vramGB = overrides.gpuVramGB ?? inferida.vramEmUsoGB

  if (tipo === 'cpu') return { tipo: 'cpu', vramGB: 0, num_gpu: 0 }

  if (tipo === 'nvidia' || tipo === 'amd') {
    return { tipo, vramGB, num_gpu: 999 }
  }

  // Integrada ou Vulkan: num_gpu proporcional à VRAM estimada
  const num_gpu = Math.max(4, Math.floor(vramGB * 5))
  return { tipo, vramGB, num_gpu }
}

function calcularCapacidade(
  cpu: CPUInfo,
  ram: RAMInfo,
  gpu: GPUInfo
): CapacidadeInfo {
  const cpuScore = Math.min(100, cpu.nucleos * 8)
  const ramScore = Math.min(100, Math.round(ram.livreGB * 12))
  const gpuScore = Math.min(
    100,
    Math.round(gpu.vramGB * MULTIPLICADOR_GPU[gpu.tipo])
  )
  const total = Math.max(1, cpuScore + ramScore + gpuScore)

  return {
    cpuScore,
    ramScore,
    gpuScore,
    cpuPct: cpuScore / total,
    ramPct: ramScore / total,
    gpuPct: gpuScore / total,
  }
}

function derivarNumGPU(gpu: GPUInfo, cap: CapacidadeInfo): number {
  if (gpu.tipo === 'cpu') return 0
  if (gpu.tipo === 'nvidia' || gpu.tipo === 'amd') return gpu.num_gpu
  const ideal = Math.max(4, Math.round(cap.gpuPct * LAYERS_MODELO))
  return Math.min(ideal, gpu.num_gpu)
}

// ── API pública ───────────────────────────────────────────────

export async function detectarHardwareRemoto(
  baseUrl: string
): Promise<HardwareRemotoInfo> {
  const overrides = lerEnvOverrides()

  const [versaoOllama, modelos] = await Promise.all([
    consultarVersao(baseUrl),
    consultarModelosAtivos(baseUrl),
  ])

  const gpuInferida = inferirGPUDeModelos(modelos)

  const nucleos = overrides.cpuNucleos ?? 4
  const ramTotalGB = overrides.ramTotalGB ?? 8

  const cpu = montarCPU(nucleos)
  const ram = montarRAM(ramTotalGB)
  const gpu = montarGPU(gpuInferida, overrides)
  const capacidade = calcularCapacidade(cpu, ram, gpu)
  const numGPU = derivarNumGPU(gpu, capacidade)

  const params: OllamaParams = {
    num_thread: cpu.num_thread,
    num_gpu: numGPU,
    keep_alive: -1,
  }

  return {
    servidor: baseUrl,
    versaoOllama,
    cpu,
    ram,
    gpu,
    capacidade,
    params,
  }
}

export function relatorioHardwareRemoto(
  hw: HardwareRemotoInfo
): string {
  const descricaoGPU: Record<GPUTipo, string> = {
    cpu: 'nenhuma — CPU pura',
    intel: `Intel integrada (~${hw.gpu.vramGB.toFixed(1)}GB compartilhado)`,
    nvidia: `NVIDIA (${hw.gpu.vramGB.toFixed(1)}GB VRAM em uso)`,
    amd: `AMD ROCm (${hw.gpu.vramGB.toFixed(1)}GB VRAM)`,
    'amd-integrated': 'AMD integrada',
    vulkan: `Vulkan / misto (${hw.gpu.vramGB.toFixed(1)}GB em uso)`,
  }

  const c = hw.capacidade
  const pct = (v: number) => `${Math.round(v * 100)}%`

  return [
    `Servidor : ${hw.servidor}  [Ollama ${hw.versaoOllama}]`,
    `CPU      : ${hw.cpu.modelo} — ${hw.cpu.nucleos} threads  [score ${c.cpuScore} · ${pct(c.cpuPct)}]`,
    `RAM      : ${hw.ram.totalGB.toFixed(1)}GB total / ${hw.ram.livreGB.toFixed(1)}GB est. livre  [score ${c.ramScore} · ${pct(c.ramPct)}]`,
    `GPU      : ${descricaoGPU[hw.gpu.tipo]} → ${hw.params.num_gpu} layers  [score ${c.gpuScore} · ${pct(c.gpuPct)}]`,
  ].join('\n')
}
