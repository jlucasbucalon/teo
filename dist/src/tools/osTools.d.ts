export interface FileInfo {
    path: string;
    nome: string;
    tamanho: number;
    modificado: string;
    tipo: 'arquivo' | 'diretorio';
}
export interface VariavelAmbiente {
    nome: string;
    valor: string;
}
export declare function lerArquivo(caminho: string): string | null;
export declare function escreverArquivo(caminho: string, conteudo: string): boolean;
export declare function listarDiretorio(caminho: string): FileInfo[];
export declare function arquivoExiste(caminho: string): boolean;
export declare function criarDiretorio(caminho: string): boolean;
export declare function deletarArquivo(caminho: string): boolean;
export declare function getVariaveisAmbiente(): VariavelAmbiente[];
export declare function getVariavel(nome: string): string | null;
export declare function getSystemInfo(): {
    plataforma: string;
    arch: string;
    home: string;
    cpuCores: number;
    memoriaTotal: number;
    hostname: string;
    nodeVersion: string;
};
export declare function getProjectRoot(): string;
export declare function getMemoryDir(): string;
export declare function getSrcDir(): string;
export declare function formatarFileInfo(files: FileInfo[]): string;
export declare function formatarSystemInfo(): string;
//# sourceMappingURL=osTools.d.ts.map