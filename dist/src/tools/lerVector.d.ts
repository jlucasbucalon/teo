export interface ConteudoNicho {
    nicho: string;
    conteudo: string;
    tamanho: number;
    atualizadoEm: string;
    existe: boolean;
    temConhecimento: boolean;
    contexto: string;
}
/**
 * Lê os metadados e conteúdo do nicho.
 * Para o agente saber se vale injetar o contexto.
 */
export declare function lerNicho(nicho: string): Promise<ConteudoNicho>;
/**
 * Retorna o .md completo formatado.
 * Usado pelo agenteTrainer — ele precisa de tudo para avaliar.
 */
export declare function lerContexto(nicho: string): Promise<string>;
/**
 * Retorna APENAS as seções do .md mais relevantes para o input.
 * Usado pelos agentes de resposta — contexto focado, sem ruído.
 *
 * Algoritmo:
 *   1. Embeda o input do usuário
 *   2. Compara com embeddings de cada seção do .md
 *   3. Retorna as topK seções acima do score mínimo
 *   4. Monta contexto formatado pronto para injetar no prompt
 *
 * @param nicho   ID do nicho (ex: "programacao")
 * @param input   Pergunta do usuário (para calcular similaridade)
 * @param topK    Máximo de seções a retornar (padrão: 3)
 * @returns       String pronta para injetar no system prompt
 */
export declare function lerContextoFocado(nicho: string, input: string, topK?: number): Promise<string>;
/**
 * Invalida o cache de um nicho.
 * Deve ser chamado pelo escreverVector.ts após qualquer escrita.
 */
export declare function invalidarCache(nicho: string): void;
/**
 * Lista todos os nichos disponíveis com metadados.
 */
export declare function listarNichos(): Promise<ConteudoNicho[]>;
//# sourceMappingURL=lerVector.d.ts.map