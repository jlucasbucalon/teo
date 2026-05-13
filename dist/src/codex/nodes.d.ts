import { ChatOllama } from '@langchain/ollama';
import { obterRaciocinio } from '../core/reasoning';
import type { Compreensao } from '../core/understand';
import type { OpenAIMessage } from '../core/types';
import type { HardwareInfo } from '../system/hardware';
import type { ModoRaciocinio } from '../core/reasoning';
import type { EtapaAgente } from '../agents/agenteProgramacao';
export declare function buildLLM(hw: HardwareInfo, modo: ModoRaciocinio): ChatOllama;
export declare function construirContexto(messages: OpenAIMessage[], compreensao: Compreensao | null, r: ReturnType<typeof obterRaciocinio>): OpenAIMessage[];
export type Rota = 'local' | 'online';
export declare function routeByMode(compreensao: Compreensao | null, modoManual: ModoRaciocinio): Rota;
interface AgentInput {
    messages: OpenAIMessage[];
    onToken: (token: string) => void;
    hw: HardwareInfo;
    modo: ModoRaciocinio;
    topico: string;
    input: string;
    trainerContext: string | null;
    onEtapa: ((etapa: EtapaAgente) => void) | null;
    nicho: string;
}
export declare function dispatchAgente(input: AgentInput): Promise<{
    resposta: string;
    modelo: string;
}>;
export {};
//# sourceMappingURL=nodes.d.ts.map