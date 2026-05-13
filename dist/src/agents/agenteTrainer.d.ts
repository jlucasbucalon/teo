export interface TreinamentoParams {
    nicho: string;
    topico: string;
    input: string;
    resposta: string;
    chatId: string | null;
}
export interface ResultadoTreinamento {
    ok: boolean;
    nicho: string;
    atualizado: boolean;
    erro?: string;
}
export declare function treinarNicho(params: TreinamentoParams): Promise<ResultadoTreinamento>;
//# sourceMappingURL=agenteTrainer.d.ts.map