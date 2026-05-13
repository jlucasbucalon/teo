import type { RAMInfo, GPUInfo, HardwareInfo } from '../system/hardware';
export type ModoRaciocinio = 'local' | 'online';
export interface ConfigRaciocinio {
    nome: ModoRaciocinio;
    num_ctx: number;
    num_predict: number;
    temperature: number;
    repeat_penalty: number;
    top_k: number;
    top_p: number;
    memoriaContextoMax: number;
}
export declare function obterRaciocinio(modo: ModoRaciocinio, hw: {
    ram: RAMInfo;
    gpu: GPUInfo;
}): ConfigRaciocinio;
export declare function getModo(): ModoRaciocinio;
export declare function setModo(novo: string): boolean;
export declare function numBatch(hw: HardwareInfo): number;
export declare function relatorioRaciocinio(r: ConfigRaciocinio): string;
//# sourceMappingURL=reasoning.d.ts.map