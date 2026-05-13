import type { OpenAIMessage } from '../core/types';
export declare const estado: {
    chatAtual: string | null;
    esperandoNomeChat: boolean;
    esperandoNomeExclusao: boolean;
    esperandoNomeAbertura: boolean;
    esperandoNomeRenomear: boolean;
    esperandoNomeExportar: boolean;
    fuzzyPendente: {
        acao: string;
        sugestao: string;
        extra?: string;
    } | null;
};
export declare function gerarChatId(): string;
export declare function carregarMemoria(chatId: string): OpenAIMessage[];
export declare function salvarMemoria(chatId: string, memoria: OpenAIMessage[]): Promise<void>;
export declare function dividirChunks(texto: string): string[];
export declare function sugerirChat(nomeDigitado: string): string | null;
export declare function criarChat(nome: string): string;
export declare function abrirChat(nome: string): string;
export declare function fecharChat(): string;
export declare function listarChats(): {
    nome: string;
    total: number;
    criado: string;
    atualizado: string;
}[];
export declare function excluirChat(nome: string): {
    ok: boolean;
    nome: string;
};
export declare function excluirLote(nomes: string[]): string;
export declare function renomearChat(oldName: string, newName: string): string;
export declare function exportarChat(nome: string): string;
export declare function statusChat(): string;
export declare function teoUpdate(): Promise<string>;
export declare function helpTexto(): string;
export declare function interpretar(input: string): string | null;
export declare function iniciarWatcher(): void;
//# sourceMappingURL=modules.d.ts.map