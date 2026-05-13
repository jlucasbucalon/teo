"use strict";
// ============================================================
//  TEO — src/core/realtime.ts
//  Ferramentas para dados em tempo real: hora, clima, data
//  Com cache, retry, métricas e tipos estendidos
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obterMetricasRealtime = obterMetricasRealtime;
exports.limparCacheRealtime = limparCacheRealtime;
exports.obterHorario = obterHorario;
exports.obterGeoPorIP = obterGeoPorIP;
exports.obterClima = obterClima;
exports.obterContextoRealtime = obterContextoRealtime;
exports.formatarContextoRealtime = formatarContextoRealtime;
const axios_1 = __importDefault(require("axios"));
const metricas = {
    chamadas_totais: 0,
    sucessos: 0,
    falhas: 0,
    timestamp_atualizacao: Date.now(),
};
function obterMetricasRealtime() {
    return { ...metricas };
}
function registrarSucesso() {
    metricas.chamadas_totais++;
    metricas.sucessos++;
    metricas.timestamp_atualizacao = Date.now();
}
function registrarFalha() {
    metricas.chamadas_totais++;
    metricas.falhas++;
    metricas.timestamp_atualizacao = Date.now();
}
// ── Cache local ─────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
function obterDoCache(chave) {
    const entry = cache.get(chave);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cache.delete(chave);
        return null;
    }
    return entry.data;
}
function salvarNoCache(chave, dados) {
    cache.set(chave, { data: dados, timestamp: Date.now() });
}
function limparCacheRealtime() {
    cache.clear();
}
// ── Retry com backoff exponencial ───────────────────────────
async function fazerRequisicaoComRetry(url, config = {}, maxTentativas = 3) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            const response = await axios_1.default.get(url, {
                ...config,
                timeout: config.timeout ?? 5000,
            });
            return response.data;
        }
        catch (err) {
            const isRetryable = err instanceof axios_1.default.AxiosError &&
                [429, 500, 502, 503, 504].includes(err.response?.status ?? 0);
            if (tentativa === maxTentativas || !isRetryable) {
                return null;
            }
            const delay = Math.min(1000 * 2 ** tentativa, 8000);
            await new Promise((res) => setTimeout(res, delay));
        }
    }
    return null;
}
// ── Funções isoladas por API ────────────────────────────────
async function obterHorarioWorldTimeAPI(timezone) {
    const cacheKey = `horario:${timezone}`;
    const cached = obterDoCache(cacheKey);
    if (cached)
        return cached;
    const data = await fazerRequisicaoComRetry(`https://worldtimeapi.org/api/timezone/${timezone}`);
    if (!data)
        return null;
    const dt = new Date(data.datetime);
    const horaPT = dt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
    });
    const dataPT = dt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: timezone,
    });
    const resultado = {
        timezone: data.timezone,
        datetime: data.datetime,
        utc_datetime: data.utc_datetime,
        day_of_week: data.day_of_week,
        week_number: data.week_number,
        utc_offset: data.utc_offset,
        raw_offset_hours: data.raw_offset / 3600,
        dst: data.dst,
        horaPT,
        dataPT,
    };
    salvarNoCache(cacheKey, resultado);
    return resultado;
}
async function obterGeoIPAPI() {
    const cacheKey = 'geo:ip';
    const cached = obterDoCache(cacheKey);
    if (cached)
        return cached;
    const data = await fazerRequisicaoComRetry('http://ip-api.com/json');
    if (!data || data.status !== 'success')
        return null;
    const resultado = {
        ip: data.query,
        cidade: data.city,
        estado: data.regionName,
        pais: data.country,
        paisCode: data.countryCode,
        lat: data.lat,
        lon: data.lon,
        provedor: data.isp,
        timezone: data.timezone,
        moeda: mapPaisParaMoeda(data.countryCode),
    };
    salvarNoCache(cacheKey, resultado);
    return resultado;
}
function mapPaisParaMoeda(countryCode) {
    const map = {
        BR: 'BRL',
        US: 'USD',
        AR: 'ARS',
        CL: 'CLP',
        CO: 'COP',
        MX: 'MXN',
    };
    return map[countryCode] ?? 'USD';
}
async function obterClimaOpenMeteo(cidade) {
    const cacheKey = `clima:${cidade.toLowerCase()}`;
    const cached = obterDoCache(cacheKey);
    if (cached)
        return cached;
    const geoData = await fazerRequisicaoComRetry('https://geocoding-api.open-meteo.com/v1/search', {
        params: {
            name: cidade,
            count: 1,
            language: 'pt',
            format: 'json',
        },
    });
    if (!geoData?.results?.length)
        return null;
    const resultadoGeo = geoData.results[0];
    if (!resultadoGeo)
        return null;
    const lat = resultadoGeo.latitude;
    const lon = resultadoGeo.longitude;
    const weatherData = await fazerRequisicaoComRetry('https://api.open-meteo.com/v1/forecast', {
        params: {
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,visibility,surface_pressure,uv_index',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min',
            timezone: 'auto',
            forecast_days: 2,
        },
    });
    if (!weatherData?.current)
        return null;
    const current = weatherData.current;
    const daily = weatherData.daily;
    const { condicao, icone } = codigoParaCondicao(current.weather_code);
    const resultado = {
        cidade,
        temperatura_c: Math.round(current.temperature_2m),
        sensacao_c: Math.round(current.apparent_temperature),
        umidade_pct: current.relative_humidity_2m,
        vento_kmh: Math.round(current.wind_speed_10m),
        condicao,
        icone,
        previsao_hoje: `${Math.round(daily.temperature_2m_max[0] ?? 0)}° / ${Math.round(daily.temperature_2m_min[0] ?? 0)}°`,
        previsao_amanha: daily.time[1]
            ? `${new Date(daily.time[1]).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} — ${Math.round(daily.temperature_2m_max[1] ?? 0)}° / ${Math.round(daily.temperature_2m_min[1] ?? 0)}°`
            : '',
        visibilidade_km: current.visibility
            ? Math.round(current.visibility / 1000)
            : undefined,
        pressao_mb: current.surface_pressure
            ? Math.round(current.surface_pressure)
            : undefined,
        indice_uv: current.uv_index
            ? Math.round(current.uv_index)
            : undefined,
    };
    salvarNoCache(cacheKey, resultado);
    return resultado;
}
function obterFeriadosBrasileiros(ano) {
    const anoAlvo = ano ?? new Date().getFullYear();
    const cacheKey = `feriados:${anoAlvo}`;
    const cached = obterDoCache(cacheKey);
    if (cached)
        return cached;
    const FERIADOS = [
        {
            nome: 'Confraternização Universal',
            data: '2025-01-01',
        },
        { nome: 'Carnaval', data: '2025-03-04' },
        { nome: 'Sexta-feira Santa', data: '2025-04-18' },
        { nome: 'Tiradentes', data: '2025-04-21' },
        { nome: 'Dia do Trabalho', data: '2025-05-01' },
        { nome: 'Corpus Christi', data: '2025-06-19' },
        { nome: 'Independência do Brasil', data: '2025-09-07' },
        { nome: 'Nossa Senhora Aparecida', data: '2025-10-12' },
        { nome: 'Finados', data: '2025-11-02' },
        {
            nome: 'Proclamação da República',
            data: '2025-11-15',
        },
        { nome: 'Natal', data: '2025-12-25' },
        {
            nome: 'Confraternização Universal',
            data: '2026-01-01',
        },
        { nome: 'Carnaval', data: '2026-02-17' },
        { nome: 'Sexta-feira Santa', data: '2026-04-03' },
        { nome: 'Tiradentes', data: '2026-04-21' },
        { nome: 'Dia do Trabalho', data: '2026-05-01' },
        { nome: 'Corpus Christi', data: '2026-05-28' },
        { nome: 'Independência do Brasil', data: '2026-09-07' },
        { nome: 'Nossa Senhora Aparecida', data: '2026-10-12' },
        { nome: 'Finados', data: '2026-11-02' },
        {
            nome: 'Proclamação da República',
            data: '2026-11-15',
        },
        { nome: 'Natal', data: '2026-12-25' },
    ];
    const anoFeriado = FERIADOS.filter((f) => f.data.startsWith(String(anoAlvo)));
    const resultado = [];
    for (const f of anoFeriado) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataFeriado = new Date(f.data).getTime();
        const dias = Math.round((dataFeriado - hoje.getTime()) / 86400000);
        const fmt = (d) => {
            const [, m, day] = d.split('-');
            return `${day}/${m}`;
        };
        resultado.push({
            nome: f.nome,
            data: f.data,
            diasFaltando: dias,
            descricao: dias === 0
                ? 'HOJE!'
                : dias === 1
                    ? 'Amanhã'
                    : `Em ${dias} dias`,
            calendario: FERIADOS.map((f) => `${fmt(f.data)} — ${f.nome}`).join('\n'),
        });
    }
    salvarNoCache(cacheKey, resultado);
    return resultado;
}
// ── Funções legado (mantidas para compatibilidade) ───────────
async function obterHorario(timezone = 'America/Sao_Paulo') {
    try {
        const resultado = await obterHorarioWorldTimeAPI(timezone);
        if (resultado)
            registrarSucesso();
        else
            registrarFalha();
        return resultado;
    }
    catch {
        registrarFalha();
        return null;
    }
}
async function obterGeoPorIP() {
    try {
        const resultado = await obterGeoIPAPI();
        if (resultado)
            registrarSucesso();
        else
            registrarFalha();
        return resultado;
    }
    catch {
        registrarFalha();
        return null;
    }
}
async function obterClima(cidade) {
    try {
        const resultado = await obterClimaOpenMeteo(cidade);
        if (resultado)
            registrarSucesso();
        else
            registrarFalha();
        return resultado;
    }
    catch {
        registrarFalha();
        return null;
    }
}
async function obterContextoRealtime(timezone, cidadeClima) {
    const geo = await obterGeoIPAPI();
    const tz = timezone ?? geo?.timezone ?? 'America/Sao_Paulo';
    const cidade = cidadeClima ?? geo?.cidade ?? 'São Paulo';
    const [horario, clima] = await Promise.all([
        obterHorarioWorldTimeAPI(tz),
        cidade
            ? obterClimaOpenMeteo(cidade)
            : Promise.resolve(null),
    ]);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const todosFeriados = [
        ...obterFeriadosBrasileiros(2025),
        ...obterFeriadosBrasileiros(2026),
    ];
    const proximo = todosFeriados.find((f) => new Date(f.data) >= hoje);
    const calendario = proximo
        ? {
            nome: proximo.nome,
            data: proximo.data,
            diasFaltando: proximo.diasFaltando,
            descricao: proximo.descricao,
            calendario: todosFeriados
                .map((f) => `${f.data.slice(5).replace('-', '/')} — ${f.nome}`)
                .join('\n'),
        }
        : null;
    if (horario)
        registrarSucesso();
    if (clima)
        registrarSucesso();
    if (!horario || !clima)
        registrarFalha();
    return {
        horario,
        clima,
        geo,
        calendario,
        timestamp: Date.now(),
    };
}
function formatarContextoRealtime(ctx) {
    const partes = [];
    if (ctx.geo) {
        partes.push(`📍 **Localização:** ${ctx.geo.cidade}, ${ctx.geo.estado}, ${ctx.geo.pais} (IP: ${ctx.geo.ip})${ctx.geo.moeda ? ` · Moeda: ${ctx.geo.moeda}` : ''}`);
    }
    if (ctx.horario) {
        const h = ctx.horario;
        partes.push(`🕐 **Horário:** ${h.horaPT} · ${h.dataPT} · ${h.timezone} · ${h.day_of_week} · semana ${h.week_number}${h.dst ? ' (DST)' : ''}`);
    }
    if (ctx.clima) {
        const c = ctx.clima;
        partes.push(`🌤️ **Clima em ${c.cidade}:** ${c.icone} ${c.condicao} · ${c.temperatura_c}°C (sensação ${c.sensacao_c}°C) · umidade ${c.umidade_pct}% · vento ${c.vento_kmh}km/h${c.indice_uv !== undefined
            ? ` · UV ${c.indice_uv}`
            : ''}${c.pressao_mb !== undefined
            ? ` · pressão ${c.pressao_mb}mb`
            : ''} · hoje ${c.previsao_hoje}${c.previsao_amanha ? ` · amanhá ${c.previsao_amanha}` : ''}`);
    }
    if (ctx.calendario) {
        partes.push(`📅 **Calendário:** ${ctx.calendario.calendario}`);
    }
    return partes.length > 0
        ? `## Contexto em Tempo Real\n${partes.join('\n')}`
        : '';
}
// ── Helpers internos ────────────────────────────────────────
function codigoParaCondicao(code) {
    const map = {
        0: { condicao: 'Céu limpo', icone: '☀️' },
        1: { condicao: 'Predominantemente limpo', icone: '🌤️' },
        2: { condicao: 'Parcialmente nublado', icone: '⛅' },
        3: { condicao: 'Encoberto', icone: '☁️' },
        45: { condicao: 'Nevoeiro', icone: '🌫️' },
        48: { condicao: 'Nevoeiro com geada', icone: '🌫️' },
        51: { condicao: 'Garoa leve', icone: '🌦️' },
        53: { condicao: 'Garoa moderada', icone: '🌦️' },
        55: { condicao: 'Garoa densa', icone: '🌧️' },
        61: { condicao: 'Chuva leve', icone: '🌧️' },
        63: { condicao: 'Chuva moderada', icone: '🌧️' },
        65: { condicao: 'Chuva forte', icone: '⛈️' },
        71: { condicao: 'Neve leve', icone: '🌨️' },
        73: { condicao: 'Neve moderada', icone: '❄️' },
        75: { condicao: 'Neve forte', icone: '❄️' },
        80: { condicao: 'Pancadas leves', icone: '🌦️' },
        81: { condicao: 'Pancadas moderadas', icone: '🌧️' },
        82: { condicao: 'Pancadas violentas', icone: '⛈️' },
        95: { condicao: 'Tempestade', icone: '⛈️' },
        96: { condicao: 'Tempestade com granizo', icone: '⛈️' },
        99: { condicao: 'Tempestade severa', icone: '⛈️' },
    };
    return (map[code] ?? { condicao: 'Desconhecido', icone: '❓' });
}
//# sourceMappingURL=realtime.js.map