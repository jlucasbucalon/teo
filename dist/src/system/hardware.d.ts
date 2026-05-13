export interface CPUInfo {
    nucleos: number;
    modelo: string;
    num_thread: number;
}
export interface RAMInfo {
    totalGB: number;
    livreGB: number;
}
export type GPUTipo = 'nvidia' | 'amd' | 'amd-integrated' | 'intel' | 'vulkan' | 'cpu';
export interface GPUInfo {
    tipo: GPUTipo;
    vramGB: number;
    num_gpu: number;
}
export interface OllamaParams {
    num_thread: number;
    num_gpu: number;
    keep_alive: number;
}
export interface CapacidadeInfo {
    cpuScore: number;
    ramScore: number;
    gpuScore: number;
    cpuPct: number;
    ramPct: number;
    gpuPct: number;
}
export interface HardwareInfo {
    cpu: CPUInfo;
    ram: RAMInfo;
    gpu: GPUInfo;
    params: OllamaParams;
    capacidade: CapacidadeInfo;
}
export declare function detectarHardware(): HardwareInfo;
export declare function relatorioHardware(hw: HardwareInfo): string;
//# sourceMappingURL=hardware.d.ts.map