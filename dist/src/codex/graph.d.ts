import { type Compreensao } from '../core/understand';
import type { OpenAIMessage } from '../core/types';
import type { HardwareInfo } from '../system/hardware';
import type { EtapaAgente } from '../agents/agenteProgramacao';
export interface TeoGraphInput {
    messages: OpenAIMessage[];
    onToken: (token: string) => void;
    chatId: string | null;
    hw: HardwareInfo;
    compreensao?: Compreensao | null;
    trainerContext?: string | null;
    onEtapa?: ((etapa: EtapaAgente) => void) | null;
}
export interface TeoGraphResult {
    resposta: string;
    compreensao: Compreensao | null;
    modeloUsado: string;
}
export declare function runTeoGraph(input: TeoGraphInput): Promise<TeoGraphResult>;
//# sourceMappingURL=graph.d.ts.map