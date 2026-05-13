import type { OpenAIMessage } from './types';
export declare function embedTexto(texto: string): Promise<number[]>;
export declare function embedLote(textos: string[]): Promise<number[][]>;
export declare function cosineSim(a: number[], b: number[]): number;
export declare function buscarMensagensSimilares(queryEmbed: number[], mensagens: OpenAIMessage[], topK: number): OpenAIMessage[];
export declare function indexarMensagens(mensagens: OpenAIMessage[]): Promise<OpenAIMessage[]>;
export declare function embedPreview(embed: number[]): string;
//# sourceMappingURL=embed.d.ts.map