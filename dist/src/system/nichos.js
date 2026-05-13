"use strict";
// ============================================================
//  TEO — src/core/nichos.ts
//  Carrega e disponibiliza os nichos definidos em src/nichos/*.json
//
//  Cache em memória — lê o disco só na primeira chamada.
//  Garante automaticamente o .md do trainer para cada nicho.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.carregarNichos = carregarNichos;
exports.getNicho = getNicho;
exports.listarIds = listarIds;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const NICHOS_DIR = path_1.default.resolve(__dirname, '../../src/codex/nichos');
const TRAINER_DIR = path_1.default.resolve(__dirname, '../../src/memory/trainer/nichos');
let _cache = null;
// ── Template do .md de conhecimento ─────────────────────────
function templateMd(nicho) {
    return [
        `# Conhecimento — ${nicho.label}`,
        `última atualização: —`,
        ``,
        `## Conceitos e fundamentos`,
        `_sem dados ainda_`,
        ``,
        `## Boas práticas`,
        `_sem dados ainda_`,
        ``,
        `## Dicas e referências`,
        `_sem dados ainda_`,
        ``,
        `## Padrões e observações`,
        `_sem dados ainda_`,
    ].join('\n');
}
// ── Garante .md do trainer para o nicho ─────────────────────
// Cria se não existir, ou sobrescreve se ainda for placeholder antigo.
function garantirMdTrainer(nicho) {
    if (!fs_1.default.existsSync(TRAINER_DIR)) {
        fs_1.default.mkdirSync(TRAINER_DIR, { recursive: true });
    }
    const file = path_1.default.join(TRAINER_DIR, `${nicho.id}.md`);
    const estaVazio = !fs_1.default.existsSync(file) ||
        fs_1.default.readFileSync(file, 'utf8').includes('_ainda sem dados_');
    if (estaVazio) {
        fs_1.default.writeFileSync(file, templateMd(nicho), 'utf8');
    }
}
// ── API pública ──────────────────────────────────────────────
function carregarNichos() {
    if (_cache !== null)
        return _cache;
    if (!fs_1.default.existsSync(NICHOS_DIR)) {
        _cache = [];
        return _cache;
    }
    const arquivos = fs_1.default
        .readdirSync(NICHOS_DIR)
        .filter((f) => f.endsWith('.json'));
    _cache = arquivos.map((arquivo) => {
        const raw = fs_1.default.readFileSync(path_1.default.join(NICHOS_DIR, arquivo), 'utf8');
        return JSON.parse(raw);
    });
    for (const nicho of _cache) {
        garantirMdTrainer(nicho);
    }
    return _cache;
}
function getNicho(id) {
    return carregarNichos().find((n) => n.id === id) ?? null;
}
function listarIds() {
    return carregarNichos().map((n) => n.id);
}
//# sourceMappingURL=nichos.js.map