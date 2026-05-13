export declare function printStart(porta: number): void;
export declare function printHardware(relatorio: string): void;
export declare function printServidor(porta: number): void;
export declare function formatPrompt(chatAtual?: string | null): string;
export declare function printStreamHeader(modelo: string, modo: 'local' | 'online'): void;
export declare function printStreamEnd(durationMs: number): void;
export interface ResponseOptions {
    texto: string;
    modelo?: string;
    durationMs?: number;
    modo?: 'local' | 'online' | 'cmd';
}
export declare function printResponse(opts: ResponseOptions): void;
export declare function printError(msg?: string): void;
export interface ComandoExibido {
    comando: string;
    descricao: string;
    variacoes: string[];
}
export declare function printAjuda(comandos: ComandoExibido[]): void;
export declare function printInfo(msg: string): void;
export declare function printModo(modo: string): void;
export declare function printReset(): void;
export declare function printExit(): void;
export declare function startSpinner(modelo?: string): void;
export declare function updateSpinner(label: string): void;
export declare function stopSpinner(): void;
import type { EtapaAgente } from '../agents/agenteProgramacao';
export declare function printClassificacao(nicho: string, agente?: string): void;
export declare function spinnerEtapa(etapa: EtapaAgente, modelo: string): void;
//# sourceMappingURL=ui.d.ts.map