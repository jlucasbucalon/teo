export type Linguagem = 'javascript' | 'js' | 'python' | 'py';
export interface RespostaCodigo {
    sucesso: boolean;
    output: string;
    linguagem: Linguagem;
    tempo_ms: number;
    erro?: string;
}
export declare function executeJavaScript(code: string, _timeout?: number): RespostaCodigo;
export declare function executePython(code: string, timeout?: number): RespostaCodigo;
export declare function executarCodigo(code: string, linguagem?: string, timeout?: number): Promise<RespostaCodigo>;
export declare function validarCodigoSeguro(code: string): {
    valido: boolean;
    aviso?: string;
};
//# sourceMappingURL=executeCode.d.ts.map