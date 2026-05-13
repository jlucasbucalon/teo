export type Nicho = string;
export type TipoTarefa = 'duvida' | 'geracao' | 'analise' | 'instrucao' | 'conversa' | 'comando' | 'indefinido';
export interface Compreensao {
    nicho: Nicho;
    tipo: TipoTarefa;
    topico: string;
    idioma: string;
    confianca: number;
    keys: string[];
    related: string[];
    embed: number[];
    timestamp: string;
    input: string;
}
export declare function gravarClassificacao(compreensao: Compreensao, chatId?: string | null): void;
export declare function classificarRapido(input: string): Compreensao;
export declare function entender(input: string, chatId?: string | null): Promise<Compreensao>;
export declare function lerUltimoContexto(): string;
//# sourceMappingURL=understand.d.ts.map