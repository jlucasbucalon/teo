"use strict";
// ============================================================
//  TEO — src/tools/escreverVector.ts
//  Ferramenta de escrita dos arquivos .md do trainer.
//  Usada exclusivamente pelo agenteTrainer.ts.
//  Sem lógica de IA — apenas filesystem.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escreverNicho = escreverNicho;
exports.escreverTarefa = escreverTarefa;
exports.escreverAgente = escreverAgente;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const lerVector_1 = require("./lerVector");
// ── Paths ─────────────────────────────────────────────────────
const BASE = path_1.default.resolve(__dirname, '../../src/memory/trainer');
const PATHS = {
    nichos: path_1.default.join(BASE, 'nichos'),
    tarefas: path_1.default.join(BASE, 'tarefas'),
    agentes: path_1.default.join(BASE, 'agentes'),
};
// ── Helpers ───────────────────────────────────────────────────
/**
 * Atualiza o campo "última atualização:" no .md com o timestamp atual.
 * Mantém o conteúdo intacto — só troca a linha de data.
 * Se o campo não existir, não faz nada.
 */
function injetarTimestamp(conteudo) {
    const agora = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    // Substitui "última atualização: <qualquer coisa>" pelo timestamp atual
    const atualizado = conteudo.replace(/^última atualização:.*$/m, `última atualização: ${agora}`);
    return atualizado;
}
// ── Core ──────────────────────────────────────────────────────
function escrever(tipo, id, conteudo) {
    try {
        const dir = PATHS[tipo];
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        // Injeta timestamp antes de salvar
        const conteudoFinal = injetarTimestamp(conteudo);
        fs_1.default.writeFileSync(path_1.default.join(dir, `${id}.md`), conteudoFinal, 'utf8');
        // Invalida o cache do lerVector — força releitura na próxima consulta
        (0, lerVector_1.invalidarCache)(id);
    }
    catch {
        // Falha silenciosa — o trainer nunca interrompe o usuário
    }
}
// ── API pública ───────────────────────────────────────────────
function escreverNicho(nicho, conteudo) {
    escrever('nichos', nicho, conteudo);
}
function escreverTarefa(tarefa, conteudo) {
    escrever('tarefas', tarefa, conteudo);
}
function escreverAgente(agente, conteudo) {
    escrever('agentes', agente, conteudo);
}
//# sourceMappingURL=escreverVector.js.map