export interface SystemState {
    uptime: string;
    uptimeMs: number;
    processos: ProcessInfo[];
    memoria: MemoriaInfo;
    modelos: ModelInfo[];
    agentes: AgenteInfo[];
    tools: ToolInfo[];
    alertas: string[];
    versao: string;
    bootTime: number;
    ultimosLogs: string[];
}
export interface ProcessInfo {
    pid: number;
    nome: string;
    status: 'ativo' | 'idle' | 'processando';
    inicio: string;
    ms: number;
}
export interface MemoriaInfo {
    contextoAtual: number;
    maxContexto: number;
    chatAtivo: string | null;
    totalMensagens: number;
}
export interface ModelInfo {
    nome: string;
    tipo: 'principal' | 'embed' | 'trainer';
    status: 'online' | 'offline' | 'loading';
    contexto: number;
}
export interface AgenteInfo {
    nome: string;
    status: 'online' | 'idle' | 'treinando';
    nicho: string;
    usoCount: number;
}
export interface ToolInfo {
    nome: string;
    status: 'online' | 'offline';
    tipo: 'realtime' | 'io' | 'ai' | 'web';
}
export declare function getBootTime(): number;
export declare function carregarEstado(): SystemState;
export declare function salvarEstado(estado: SystemState): void;
export declare function atualizarEstado(partial: Partial<SystemState>): void;
export declare function logAcao(tipo: string, detalhes: string): void;
export declare function marcarAgenteUso(nome: string): void;
export declare function formatarEstado(): string;
//# sourceMappingURL=systemState.d.ts.map