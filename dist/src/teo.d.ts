import type { Compreensao } from './core/understand';
import type { OpenAIMessage } from './core/types';
import type { EtapaAgente } from './agents/agenteProgramacao';
export declare function inicializarHardware(): Promise<void>;
export declare function invalidarCacheHardware(): void;
export interface TeoChatOptions {
    compreensao?: Compreensao | null;
    trainerContext?: string | null;
}
export declare function teoChat(messages: OpenAIMessage[], onToken: (token: string) => void, chatId?: string | null, options?: TeoChatOptions, onEtapa?: (etapa: EtapaAgente) => void): Promise<{
    resposta: string;
    compreensao: Compreensao | null;
    modeloUsado: string;
}>;
//# sourceMappingURL=teo.d.ts.map