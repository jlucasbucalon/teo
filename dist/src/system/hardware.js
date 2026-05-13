"use strict";
// ============================================================
//  TEO — src/system/hardware.ts
//  Detecção de hardware + distribuição proporcional de carga
//
//  Cada componente recebe um score (0-100) baseado na capacidade
//  real. Os parâmetros do Ollama são derivados dessas proporções:
//    GPU dedicada → máximo de layers (999)
//    GPU integrada → layers proporcionais ao score
//    CPU → sempre todos os threads
//    RAM → contexto calculado pelo que está livre
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectarHardware = detectarHardware;
exports.relatorioHardware = relatorioHardware;
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
// ── Estimativa de layers para modelos 7-8B ───────────────────
// llama3.1:8b, qwen2.5:7b, mistral:7b → 32-33 layers típicos
const LAYERS_MODELO = 33;
// ── CPU ──────────────────────────────────────────────────────
function detectarCPU() {
    const cpus = os_1.default.cpus();
    const nucleos = cpus.length;
    const modelo = cpus[0]?.model ?? 'desconhecido';
    return { nucleos, modelo, num_thread: nucleos };
}
// ── RAM ──────────────────────────────────────────────────────
function detectarRAM() {
    const totalGB = os_1.default.totalmem() / 1024 ** 3;
    const livreGB = os_1.default.freemem() / 1024 ** 3;
    return { totalGB, livreGB };
}
// ── GPU ──────────────────────────────────────────────────────
function detectarGPU() {
    // ── NVIDIA (cross-platform) ──────────────────────────────
    try {
        const out = (0, child_process_1.execSync)('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] })
            .toString()
            .trim();
        if (out) {
            const parts = out.split(',');
            const vramMB = parseInt(parts[1] ?? '0', 10);
            const vramGB = vramMB / 1024;
            return { tipo: 'nvidia', vramGB, num_gpu: 999 };
        }
    }
    catch { /* sem NVIDIA */ }
    // ── AMD ROCm (Linux) ─────────────────────────────────────
    try {
        const out = (0, child_process_1.execSync)('rocm-smi --showmeminfo vram --csv', {
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'ignore'],
        }).toString();
        if (out.includes('VRAM')) {
            return { tipo: 'amd', vramGB: 0, num_gpu: 999 };
        }
    }
    catch { /* sem ROCm */ }
    // ── Windows: WMIC ────────────────────────────────────────
    // Detecta Intel UHD / Iris / AMD integrada antes de tentar lspci
    try {
        const out = (0, child_process_1.execSync)('wmic path win32_VideoController get Name /format:list', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] })
            .toString()
            .toLowerCase();
        const isIntel = out.includes('intel') &&
            (out.includes('uhd') ||
                out.includes('iris') ||
                out.includes('hd graphics') ||
                out.includes('arc'));
        if (isIntel) {
            return gpuIntelIntegrada();
        }
        const isAMDIntegrada = out.includes('amd') ||
            out.includes('radeon') ||
            out.includes('vega');
        if (isAMDIntegrada) {
            return { tipo: 'amd-integrated', vramGB: 1, num_gpu: 16 };
        }
    }
    catch { /* sem WMIC — não é Windows */ }
    // ── Linux: lspci ─────────────────────────────────────────
    try {
        const out = (0, child_process_1.execSync)('lspci 2>/dev/null | grep -i "VGA\\|Display\\|3D"', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] })
            .toString()
            .toLowerCase();
        if (out.includes('intel')) {
            return gpuIntelIntegrada();
        }
        if (out.includes('amd') || out.includes('radeon')) {
            return { tipo: 'amd-integrated', vramGB: 1, num_gpu: 16 };
        }
    }
    catch { /* sem lspci */ }
    // ── Vulkan genérico ──────────────────────────────────────
    try {
        const out = (0, child_process_1.execSync)('vulkaninfo 2>/dev/null | grep deviceName', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        if (out.trim()) {
            return { tipo: 'vulkan', vramGB: 0, num_gpu: 8 };
        }
    }
    catch { /* sem Vulkan */ }
    return { tipo: 'cpu', vramGB: 0, num_gpu: 0 };
}
// ── Intel integrada: estima VRAM a partir da RAM total ───────
// UHD / Iris usam memória compartilhada do sistema.
// Estimativa conservadora: ~10% da RAM total, cap em 3GB.
function gpuIntelIntegrada() {
    const totalGB = os_1.default.totalmem() / 1024 ** 3;
    const vramGB = Math.max(1, Math.min(3, Math.round(totalGB * 0.10)));
    const num_gpu = Math.max(4, Math.floor(vramGB * 5));
    return { tipo: 'intel', vramGB, num_gpu };
}
// ── Scores de capacidade ─────────────────────────────────────
//
// CPU: cada núcleo lógico vale 8 pontos (máx 100)
// RAM: cada GB livre vale 12 pontos (máx 100)
// GPU: VRAM × multiplicador por tipo de GPU
//
// Multiplicadores refletem largura de banda e velocidade:
//   NVIDIA dedicada  → 22 (HBM/GDDR6, muito rápida)
//   AMD dedicada     → 18 (GDDR6, rápida)
//   Vulkan genérico  → 8  (variável)
//   Intel integrada  → 5  (LPDDR4X compartilhada, lenta)
//   AMD integrada    → 4  (DDR4 compartilhada, lenta)
const MULTIPLICADOR_GPU = {
    nvidia: 22,
    amd: 18,
    vulkan: 8,
    intel: 5,
    'amd-integrated': 4,
    cpu: 0,
};
function calcularCapacidade(cpu, ram, gpu) {
    const cpuScore = Math.min(100, cpu.nucleos * 8);
    const ramScore = Math.min(100, Math.round(ram.livreGB * 12));
    const gpuScore = Math.min(100, Math.round(gpu.vramGB * MULTIPLICADOR_GPU[gpu.tipo]));
    const total = Math.max(1, cpuScore + ramScore + gpuScore);
    return {
        cpuScore,
        ramScore,
        gpuScore,
        cpuPct: cpuScore / total,
        ramPct: ramScore / total,
        gpuPct: gpuScore / total,
    };
}
// ── Distribuição de layers ────────────────────────────────────
//
// GPU dedicada (NVIDIA/AMD): 999 → Ollama decide o máximo
// GPU integrada (Intel/AMD): layers ∝ gpuPct, cap pelo num_gpu
// CPU only: 0
function derivarNumGPU(gpu, cap) {
    if (gpu.tipo === 'cpu')
        return 0;
    if (gpu.tipo === 'nvidia' || gpu.tipo === 'amd')
        return gpu.num_gpu;
    // Integrada ou Vulkan: proporção da capacidade, mínimo 4 layers
    const ideal = Math.max(4, Math.round(cap.gpuPct * LAYERS_MODELO));
    return Math.min(ideal, gpu.num_gpu);
}
// ── Hardware completo ────────────────────────────────────────
function detectarHardware() {
    const cpu = detectarCPU();
    const ram = detectarRAM();
    const gpu = detectarGPU();
    const capacidade = calcularCapacidade(cpu, ram, gpu);
    const numGPU = derivarNumGPU(gpu, capacidade);
    return {
        cpu,
        ram,
        gpu,
        capacidade,
        params: {
            num_thread: cpu.num_thread,
            num_gpu: numGPU,
            keep_alive: -1,
        },
    };
}
// ── Relatório legível ────────────────────────────────────────
function relatorioHardware(hw) {
    const descricaoGPU = {
        cpu: 'nenhuma — CPU pura',
        intel: `Intel integrada (~${hw.gpu.vramGB}GB compartilhado)`,
        nvidia: `NVIDIA (${hw.gpu.vramGB.toFixed(1)}GB VRAM)`,
        amd: `AMD ROCm (${hw.gpu.vramGB.toFixed(1)}GB VRAM)`,
        'amd-integrated': 'AMD integrada',
        vulkan: 'Vulkan (genérico)',
    };
    const c = hw.capacidade;
    const pct = (v) => `${Math.round(v * 100)}%`;
    return [
        `CPU : ${hw.cpu.modelo} — ${hw.cpu.nucleos} threads  [score ${c.cpuScore} · ${pct(c.cpuPct)}]`,
        `RAM : ${hw.ram.totalGB.toFixed(1)}GB total / ${hw.ram.livreGB.toFixed(1)}GB livre  [score ${c.ramScore} · ${pct(c.ramPct)}]`,
        `GPU : ${descricaoGPU[hw.gpu.tipo]} → ${hw.params.num_gpu} layers  [score ${c.gpuScore} · ${pct(c.gpuPct)}]`,
    ].join('\n');
}
//# sourceMappingURL=hardware.js.map