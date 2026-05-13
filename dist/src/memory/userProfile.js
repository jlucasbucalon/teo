"use strict";
// ============================================================
//  TEO — src/memory/userProfile.ts
//  Perfil persistente do usuário — aprendido ao longo do tempo
//  TEO é responsavel por atualizar e manter este arquivo
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.carregarPerfil = carregarPerfil;
exports.salvarPerfil = salvarPerfil;
exports.atualizarPerfilGeo = atualizarPerfilGeo;
exports.atualizarPerfilInteracao = atualizarPerfilInteracao;
exports.incrementarChats = incrementarChats;
exports.formatarPerfil = formatarPerfil;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PROFILE_PATH = path.resolve(__dirname, '../../memory/userProfile.json');
const DEFAULT_PROFILE = {
    nome: null,
    cidade: null,
    estado: null,
    pais: null,
    ip: null,
    timezone: null,
    primeiraInteracao: null,
    ultimaInteracao: null,
    totalChats: 0,
    idiomaPreferido: 'pt-BR',
    modeloPrincipal: null,
    preferencias: {
        modoDefault: 'local',
        buscaAutomatica: true,
        climaAtivado: true,
    },
    interesses: [],
    notas: '',
};
function carregarPerfil() {
    try {
        if (fs.existsSync(PROFILE_PATH)) {
            const raw = fs.readFileSync(PROFILE_PATH, 'utf-8');
            return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
        }
    }
    catch {
        /* ignore */
    }
    return { ...DEFAULT_PROFILE };
}
function salvarPerfil(perfil) {
    try {
        const dir = path.dirname(PROFILE_PATH);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PROFILE_PATH, JSON.stringify(perfil, null, 2));
    }
    catch (err) {
        console.error('Erro ao salvar perfil:', err);
    }
}
function atualizarPerfilGeo(cidade, estado, pais, ip, timezone) {
    const perfil = carregarPerfil();
    perfil.cidade = cidade;
    perfil.estado = estado;
    perfil.pais = pais;
    perfil.ip = ip;
    perfil.timezone = timezone;
    salvarPerfil(perfil);
}
function atualizarPerfilInteracao(nome, interesses) {
    const perfil = carregarPerfil();
    if (nome && !perfil.nome)
        perfil.nome = nome;
    if (interesses) {
        interesses.forEach((i) => {
            if (!perfil.interesses.includes(i))
                perfil.interesses.push(i);
        });
    }
    perfil.ultimaInteracao = new Date().toISOString();
    if (!perfil.primeiraInteracao)
        perfil.primeiraInteracao = perfil.ultimaInteracao;
    salvarPerfil(perfil);
}
function incrementarChats() {
    const perfil = carregarPerfil();
    perfil.totalChats++;
    salvarPerfil(perfil);
}
function formatarPerfil() {
    const p = carregarPerfil();
    const partes = [];
    partes.push(`## Perfil do Usuário`);
    if (p.nome)
        partes.push(`Nome: ${p.nome}`);
    if (p.cidade)
        partes.push(`Localização: ${p.cidade}, ${p.estado}, ${p.pais}`);
    partes.push(`Timezone: ${p.timezone ?? 'desconhecido'}`);
    partes.push(`Chats: ${p.totalChats}`);
    partes.push(`Última interação: ${p.ultimaInteracao ? new Date(p.ultimaInteracao).toLocaleString('pt-BR') : 'nenhuma'}`);
    if (p.interesses.length > 0)
        partes.push(`Interesses: ${p.interesses.join(', ')}`);
    if (p.preferencias.modoDefault)
        partes.push(`Modo preferido: ${p.preferencias.modoDefault}`);
    return partes.join('\n');
}
//# sourceMappingURL=userProfile.js.map