import type { EtapaAgente } from './agenteProgramacao';
import type { OpenAIMessage } from '../core/types';
import type { HardwareInfo } from '../system/hardware';
import type { ModoRaciocinio } from '../core/reasoning';
export interface AgenteTeoInput {
    messages: OpenAIMessage[];
    onToken: (token: string) => void;
    hw: HardwareInfo;
    modo: ModoRaciocinio;
    topico: string;
    input: string;
    trainerContext?: string | null;
    onEtapa?: ((etapa: EtapaAgente) => void) | null;
    nicho?: string;
}
export interface AgenteTeoOutput {
    resposta: string;
    modelo: string;
}
export declare function agenteTeo(input: AgenteTeoInput): Promise<AgenteTeoOutput>;
//# sourceMappingURL=agenteTeo.d.ts.map