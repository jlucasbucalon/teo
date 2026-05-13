import type { HardwareInfo } from './hardware';
export interface HardwareRemotoInfo extends HardwareInfo {
    servidor: string;
    versaoOllama: string;
}
export declare function detectarHardwareRemoto(baseUrl: string): Promise<HardwareRemotoInfo>;
export declare function relatorioHardwareRemoto(hw: HardwareRemotoInfo): string;
//# sourceMappingURL=remoteHardware.d.ts.map