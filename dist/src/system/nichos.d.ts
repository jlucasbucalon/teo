export interface NichoConfig {
    id: string;
    label: string;
    description: string;
    keywords: string[];
    related: string[];
}
export declare function carregarNichos(): NichoConfig[];
export declare function getNicho(id: string): NichoConfig | null;
export declare function listarIds(): string[];
//# sourceMappingURL=nichos.d.ts.map