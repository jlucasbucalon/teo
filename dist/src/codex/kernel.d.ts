export interface KernelContext {
    perfil: string;
    estado: string;
    sistema: string;
    timestamp: number;
}
export interface KernelDecision {
    acao: 'responder' | 'buscar_web' | 'executar' | 'treinar' | 'consultar_ferramenta';
    confianca: number;
    reason: string;
}
export type KernelPriority = 'critical' | 'high' | 'normal' | 'low';
export interface KernelTask {
    id: string;
    tipo: string;
    prioridade: KernelPriority;
    data: Record<string, unknown>;
    status: 'pending' | 'running' | 'done' | 'error';
    inicio: number;
    resultado?: unknown;
    erro?: string;
}
export declare function novoTaskId(): string;
export declare function buildKernelContext(): Promise<KernelContext>;
export declare function formatarKernelContext(ctx: KernelContext): string;
export declare function decidaPrioridade(input: string): KernelDecision;
export declare function criarTask(tipo: string, prioridade: KernelPriority, data: Record<string, unknown>): KernelTask;
export declare function getTasks(): KernelTask[];
export declare function getTasksPorPrioridade(prioridade: KernelPriority): KernelTask[];
export declare function marcarTaskDone(taskId: string, resultado: unknown): void;
export declare function marcarTaskError(taskId: string, erro: string): void;
export declare function limparTasksAntigas(maxAgeMs?: number): void;
export declare function aprenderDoInput(input: string, resposta: string): void;
export declare function buildSystemContext(injectAsSystem?: boolean): Promise<string>;
//# sourceMappingURL=kernel.d.ts.map