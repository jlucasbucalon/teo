"use strict";
// ============================================================
//  TEO — src/kernel/kernel.ts
//  KERNEL DO SISTEMA OPERACIONAL
//  Gerencia processos, memória, I/O e orquestração central
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.novoTaskId = novoTaskId;
exports.buildKernelContext = buildKernelContext;
exports.formatarKernelContext = formatarKernelContext;
exports.decidaPrioridade = decidaPrioridade;
exports.criarTask = criarTask;
exports.getTasks = getTasks;
exports.getTasksPorPrioridade = getTasksPorPrioridade;
exports.marcarTaskDone = marcarTaskDone;
exports.marcarTaskError = marcarTaskError;
exports.limparTasksAntigas = limparTasksAntigas;
exports.aprenderDoInput = aprenderDoInput;
exports.buildSystemContext = buildSystemContext;
const userProfile_1 = require("../memory/userProfile");
const systemState_1 = require("../memory/systemState");
const osTools_1 = require("../tools/osTools");
// ── Kernel Core ─────────────────────────────────────────────
let _taskCounter = 0;
function novoTaskId() {
    return `task_${Date.now()}_${++_taskCounter}`;
}
async function buildKernelContext() {
    const [perfil, estado, sistema] = await Promise.all([
        Promise.resolve((0, userProfile_1.formatarPerfil)()),
        Promise.resolve((0, systemState_1.formatarEstado)()),
        Promise.resolve((0, osTools_1.formatarSystemInfo)()),
    ]);
    return {
        perfil,
        estado,
        sistema,
        timestamp: Date.now(),
    };
}
function formatarKernelContext(ctx) {
    const partes = [];
    partes.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    partes.push('KERNEL — CONTEXTO OPERACIONAL DO TEO');
    partes.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    partes.push('');
    partes.push(ctx.perfil);
    partes.push('');
    partes.push(ctx.estado);
    return partes.join('\n');
}
// ── Decisões automáticas ────────────────────────────────────
function decidaPrioridade(input) {
    const t = input.toLowerCase();
    // Critical: emergência, crash, erro urgente
    if (/\b(ajuda|help|erro|crash|falhou|falha|problema|bug|emergency)\b/i.test(t)) {
        return {
            acao: 'responder',
            confianca: 0.95,
            reason: 'Input crítico — resposta imediata',
        };
    }
    // Executar código
    if (/\b(executa|roda|testa|run|execute|roda isso)\b/i.test(t)) {
        return {
            acao: 'executar',
            confianca: 0.9,
            reason: 'Comando de execução detectado',
        };
    }
    // Treinar/aprender
    if (/\b(ensina|treina|aprender|ensine|lembra)\b/i.test(t)) {
        return {
            acao: 'treinar',
            confianca: 0.85,
            reason: 'Requisição de aprendizado',
        };
    }
    // Buscar web
    if (/\b(busca|pesquisa|google|search|procurar|noticia|notícia)\b/i.test(t)) {
        return {
            acao: 'buscar_web',
            confianca: 0.8,
            reason: 'Requisição de busca na web',
        };
    }
    // Consultar ferramenta do sistema
    if (/\b(hora|data|clima|clima|estado do sistema|status|que horas|que dia)\b/i.test(t)) {
        return {
            acao: 'consultar_ferramenta',
            confianca: 0.9,
            reason: 'Query de dados operacionais',
        };
    }
    return {
        acao: 'responder',
        confianca: 0.7,
        reason: 'Conversa normal',
    };
}
// ── Processamento assíncrono ────────────────────────────────
const _tasks = new Map();
function criarTask(tipo, prioridade, data) {
    const task = {
        id: novoTaskId(),
        tipo,
        prioridade,
        data,
        status: 'pending',
        inicio: Date.now(),
    };
    _tasks.set(task.id, task);
    return task;
}
function getTasks() {
    return Array.from(_tasks.values());
}
function getTasksPorPrioridade(prioridade) {
    return Array.from(_tasks.values()).filter((t) => t.prioridade === prioridade && t.status === 'pending');
}
function marcarTaskDone(taskId, resultado) {
    const task = _tasks.get(taskId);
    if (task) {
        task.status = 'done';
        task.resultado = resultado;
        (0, systemState_1.logAcao)('TASK_DONE', `${task.tipo} — ${taskId} concluído em ${Date.now() - task.inicio}ms`);
    }
}
function marcarTaskError(taskId, erro) {
    const task = _tasks.get(taskId);
    if (task) {
        task.status = 'error';
        task.erro = erro;
        (0, systemState_1.logAcao)('TASK_ERROR', `${task.tipo} — ${taskId} erro: ${erro}`);
    }
}
function limparTasksAntigas(maxAgeMs = 5 * 60 * 1000) {
    const agora = Date.now();
    for (const [id, task] of _tasks) {
        if (task.status === 'done' &&
            agora - task.inicio > maxAgeMs) {
            _tasks.delete(id);
        }
    }
}
// ── Auto-update perfil ──────────────────────────────────────
function aprenderDoInput(input, resposta) {
    const perfil = (0, userProfile_1.carregarPerfil)();
    // Detectar interesses por keywords
    const keywords = [
        'programação',
        'código',
        'python',
        'javascript',
        'java',
        'typescript',
        'hardware',
        'computador',
        'pc',
        'server',
        'servidor',
        'rede',
        'network',
        'docker',
        'linux',
        'windows',
        'ia',
        'ai',
        'machine learning',
        'nlp',
        'web',
        'frontend',
        'backend',
        'api',
    ];
    keywords.forEach((kw) => {
        if (input.toLowerCase().includes(kw) &&
            !perfil.interesses.includes(kw)) {
            perfil.interesses.push(kw);
        }
    });
    (0, userProfile_1.salvarPerfil)(perfil);
}
// ── Injeção de contexto para agente ─────────────────────────
async function buildSystemContext(injectAsSystem = true) {
    const ctx = await buildKernelContext();
    const parts = [];
    // Identidade
    parts.push('## Contexto Operacional TEO');
    // Perfil
    parts.push(ctx.perfil);
    // Estado do sistema
    parts.push(ctx.estado);
    // Sistema operacional
    parts.push(ctx.sistema);
    // Variaveis de ambiente (não sensíveis)
    const vars = (0, osTools_1.getVariaveisAmbiente)();
    const naoSensiveis = vars.filter((v) => !/KEY|SECRET|PASS|TOKEN|API/i.test(v.nome));
    if (naoSensiveis.length > 0) {
        const envLines = naoSensiveis
            .slice(0, 10)
            .map((v) => `  ${v.nome}=${v.valor}`)
            .join('\n');
        parts.push(`## Variaveis de Ambiente (não sensíveis)\n${envLines}`);
    }
    return parts.join('\n\n');
}
//# sourceMappingURL=kernel.js.map