"use strict";
// ============================================================
//  TEO — src/tools/osTools.ts
//  Ferramentas nativas do sistema operacional
//  TEO usa estas para interagir com o mundo real
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
exports.lerArquivo = lerArquivo;
exports.escreverArquivo = escreverArquivo;
exports.listarDiretorio = listarDiretorio;
exports.arquivoExiste = arquivoExiste;
exports.criarDiretorio = criarDiretorio;
exports.deletarArquivo = deletarArquivo;
exports.getVariaveisAmbiente = getVariaveisAmbiente;
exports.getVariavel = getVariavel;
exports.getSystemInfo = getSystemInfo;
exports.getProjectRoot = getProjectRoot;
exports.getMemoryDir = getMemoryDir;
exports.getSrcDir = getSrcDir;
exports.formatarFileInfo = formatarFileInfo;
exports.formatarSystemInfo = formatarSystemInfo;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// ── Sistema de arquivos ─────────────────────────────────────
function lerArquivo(caminho) {
    try {
        if (!fs.existsSync(caminho))
            return null;
        return fs.readFileSync(caminho, 'utf-8');
    }
    catch {
        return null;
    }
}
function escreverArquivo(caminho, conteudo) {
    try {
        const dir = path.dirname(caminho);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(caminho, conteudo, 'utf-8');
        return true;
    }
    catch {
        return false;
    }
}
function listarDiretorio(caminho) {
    try {
        if (!fs.existsSync(caminho))
            return [];
        return fs.readdirSync(caminho).map((nome) => {
            const full = path.join(caminho, nome);
            const stat = fs.statSync(full);
            return {
                path: full,
                nome,
                tamanho: stat.size,
                modificado: stat.mtime.toISOString(),
                tipo: stat.isDirectory() ? 'diretorio' : 'arquivo',
            };
        });
    }
    catch {
        return [];
    }
}
function arquivoExiste(caminho) {
    return fs.existsSync(caminho);
}
function criarDiretorio(caminho) {
    try {
        fs.mkdirSync(caminho, { recursive: true });
        return true;
    }
    catch {
        return false;
    }
}
function deletarArquivo(caminho) {
    try {
        fs.unlinkSync(caminho);
        return true;
    }
    catch {
        return false;
    }
}
// ── Variáveis de ambiente ────────────────────────────────────
function getVariaveisAmbiente() {
    return Object.entries(process.env).map(([nome, valor]) => ({
        nome,
        valor: valor ?? '',
    }));
}
function getVariavel(nome) {
    return process.env[nome] ?? null;
}
// ── Info do sistema ─────────────────────────────────────────
function getSystemInfo() {
    return {
        plataforma: os.platform(),
        arch: os.arch(),
        home: os.homedir(),
        cpuCores: os.cpus().length,
        memoriaTotal: os.totalmem(),
        hostname: os.hostname(),
        nodeVersion: process.version,
    };
}
// ── Path do projeto ─────────────────────────────────────────
function getProjectRoot() {
    return path.resolve(__dirname, '../..');
}
function getMemoryDir() {
    return path.resolve(__dirname, '../../memory');
}
function getSrcDir() {
    return path.resolve(__dirname, '../..');
}
// ── Formatação para contexto do agente ─────────────────────
function formatarFileInfo(files) {
    if (files.length === 0)
        return 'Diretório vazio ou inexistente';
    return files
        .map((f) => {
        const size = f.tipo === 'diretorio'
            ? '📁'
            : `${formatarTamanho(f.tamanho)}`;
        const mod = new Date(f.modificado).toLocaleString('pt-BR');
        return `  ${size} ${f.nome} — ${mod}`;
    })
        .join('\n');
}
function formatarTamanho(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
function formatarSystemInfo() {
    const info = getSystemInfo();
    return `## Sistema Operacional
Plataforma: ${info.plataforma} (${info.arch})
Hostname: ${info.hostname}
CPU cores: ${info.cpuCores}
RAM total: ${(info.memoriaTotal / 1024 ** 3).toFixed(1)}GB
Node: ${info.nodeVersion}
Raiz do projeto: ${getProjectRoot()}`;
}
//# sourceMappingURL=osTools.js.map