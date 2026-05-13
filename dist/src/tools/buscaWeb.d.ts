import type { ModoRaciocinio } from '../core/reasoning';
export interface DecisaoBusca {
    buscar: boolean;
    maxResultados: number;
}
export declare function decidirBusca(modo: ModoRaciocinio): DecisaoBusca;
/**
 * Otimiza a query antes de enviar para a API:
 * - Remove prefixo "teo" e pontuação
 * - Remove stop words
 * - Adiciona ano atual para nichos técnicos
 * - Limita tamanho a 100 chars
 */
export declare function otimizarQuery(query: string, nicho?: string): string;
export interface ResultadoBusca {
    title: string;
    url: string;
    content: string;
}
export interface RespostaBusca {
    resultados: ResultadoBusca[];
    query: string;
    queryUsada: string;
    cached: boolean;
    erro?: string;
}
export declare function buscaWeb(query: string, maxResultados?: number, nicho?: string): Promise<RespostaBusca>;
/**
 * Limpa o cache de buscas manualmente.
 */
export declare function limparCacheBusca(): void;
//# sourceMappingURL=buscaWeb.d.ts.map