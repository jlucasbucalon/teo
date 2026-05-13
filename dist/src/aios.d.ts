#!/usr/bin/env node
export declare const TEO: {
    readonly modelo: string;
    readonly embedModelo: string;
    readonly trainerKey: string | null;
    readonly trainerModel: string;
    readonly trainerUrl: string;
    readonly ollamaUrl: string;
    readonly porta: number;
    readonly ollamaApiKey: string | null;
    readonly agenteCodigoModel: string | null;
};
export declare function verificarOllama(): Promise<boolean>;
type ShutdownFn = () => void | Promise<void>;
export declare function onShutdown(fn: ShutdownFn): void;
export declare function estaNoTerminal(): boolean;
export declare function boot(): Promise<void>;
export {};
//# sourceMappingURL=aios.d.ts.map