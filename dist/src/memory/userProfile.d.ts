export interface UserProfile {
    nome: string | null;
    cidade: string | null;
    estado: string | null;
    pais: string | null;
    ip: string | null;
    timezone: string | null;
    primeiraInteracao: string | null;
    ultimaInteracao: string | null;
    totalChats: number;
    idiomaPreferido: string;
    modeloPrincipal: string | null;
    preferencias: {
        modoDefault: 'local' | 'online';
        buscaAutomatica: boolean;
        climaAtivado: boolean;
    };
    interesses: string[];
    notas: string;
}
export declare function carregarPerfil(): UserProfile;
export declare function salvarPerfil(perfil: UserProfile): void;
export declare function atualizarPerfilGeo(cidade: string, estado: string, pais: string, ip: string, timezone: string): void;
export declare function atualizarPerfilInteracao(nome?: string, interesses?: string[]): void;
export declare function incrementarChats(): void;
export declare function formatarPerfil(): string;
//# sourceMappingURL=userProfile.d.ts.map