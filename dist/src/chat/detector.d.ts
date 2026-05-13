export interface ResultadoDetecao {
    /** true = é um comando, não deve ir pro agente */
    ehComando: boolean;
    /** resultado da execução ou null se passou pro agente */
    resultado: string | null;
    /** verbo corrigido, se aplicável */
    verboCorrigido?: string;
    /** chat sugerido (fuzzy name), se aplicável */
    chatSugerido?: string;
    /** mensagem de ajuda quando não é comando mas parece intenção */
    ajuda?: string;
}
export declare function detectarComando(input: string): ResultadoDetecao;
//# sourceMappingURL=detector.d.ts.map