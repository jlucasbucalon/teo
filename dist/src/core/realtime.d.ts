export interface FeriadoInfo {
    nome: string;
    data: string;
    diasFaltando: number;
    descricao: string;
    calendario: string;
}
export interface GeoInfo {
    ip: string;
    cidade: string;
    estado: string;
    pais: string;
    paisCode: string;
    lat: number;
    lon: number;
    provedor: string;
    timezone: string;
    moeda?: string;
}
export interface TimeInfo {
    timezone: string;
    datetime: string;
    utc_datetime: string;
    day_of_week: string;
    week_number: number;
    utc_offset: string;
    raw_offset_hours: number;
    dst: boolean;
    horaPT: string;
    dataPT: string;
}
export interface ClimaInfo {
    cidade: string;
    temperatura_c: number;
    sensacao_c: number;
    umidade_pct: number;
    vento_kmh: number;
    condicao: string;
    icone: string;
    previsao_hoje: string;
    previsao_amanha: string;
    visibilidade_km?: number | undefined;
    pressao_mb?: number | undefined;
    indice_uv?: number | undefined;
}
export interface MetricasRealtime {
    chamadas_totais: number;
    sucessos: number;
    falhas: number;
    timestamp_atualizacao: number;
}
export declare function obterMetricasRealtime(): MetricasRealtime;
export declare function limparCacheRealtime(): void;
export declare function obterHorario(timezone?: string): Promise<TimeInfo | null>;
export declare function obterGeoPorIP(): Promise<GeoInfo | null>;
export declare function obterClima(cidade: string): Promise<ClimaInfo | null>;
export interface RealtimeContext {
    horario: TimeInfo | null;
    clima: ClimaInfo | null;
    geo: GeoInfo | null;
    calendario: FeriadoInfo | null;
    timestamp: number;
}
export declare function obterContextoRealtime(timezone?: string, cidadeClima?: string): Promise<RealtimeContext>;
export declare function formatarContextoRealtime(ctx: RealtimeContext): string;
//# sourceMappingURL=realtime.d.ts.map