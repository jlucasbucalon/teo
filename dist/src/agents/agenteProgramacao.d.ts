import type { OpenAIMessage } from '../core/types';
import type { HardwareInfo } from '../system/hardware';
import type { ModoRaciocinio } from '../core/reasoning';
export type EtapaAgente = {
    tipo: 'lendo_conhecimento';
    nicho: string;
} | {
    tipo: 'buscando_web';
    query: string;
} | {
    tipo: 'pensando';
} | {
    tipo: 'respondendo';
};
export interface AgenteProgramacaoInput {
    messages: OpenAIMessage[];
    onToken: (token: string) => void;
    trainerContext: string;
    hw: HardwareInfo;
    modo: ModoRaciocinio;
    topico: string;
    input: string;
    onEtapa?: (etapa: EtapaAgente) => void;
}
export interface AgenteProgramacaoOutput {
    resposta: string;
    modelo: string;
}
export declare function agenteProgramacao(input: AgenteProgramacaoInput): Promise<AgenteProgramacaoOutput>;
//# sourceMappingURL=agenteProgramacao.d.ts.map