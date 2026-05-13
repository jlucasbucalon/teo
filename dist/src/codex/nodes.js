"use strict";
// ============================================================
//  TEO — src/core/graph/nodes.ts
//  Nós reutilizáveis do LangGraph
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLLM = buildLLM;
exports.construirContexto = construirContexto;
exports.routeByMode = routeByMode;
exports.dispatchAgente = dispatchAgente;
const ollama_1 = require("@langchain/ollama");
const messages_1 = require("@langchain/core/messages");
const aios_1 = require("../aios");
const reasoning_1 = require("../core/reasoning");
const embed_1 = require("../core/embed");
const prompt_1 = require("./prompt");
const agenteProgramacao_1 = require("../agents/agenteProgramacao");
const agenteTeo_1 = require("../agents/agenteTeo");
// ── Build LLM helper ────────────────────────────────────────
function numBatch(hw) {
    if (hw.gpu.vramGB >= 12)
        return 2048;
    if (hw.gpu.vramGB >= 8)
        return 1024;
    if (hw.gpu.vramGB >= 4)
        return 512;
    if (hw.ram.livreGB >= 6)
        return 512;
    if (hw.ram.livreGB >= 3)
        return 256;
    return 128;
}
function buildLLM(hw, modo) {
    const r = (0, reasoning_1.obterRaciocinio)(modo, hw);
    return new ollama_1.ChatOllama({
        baseUrl: aios_1.TEO.ollamaUrl,
        model: aios_1.TEO.modelo,
        numThread: hw.params.num_thread,
        numGpu: hw.params.num_gpu,
        keepAlive: -1,
        numBatch: numBatch(hw),
        numCtx: r.num_ctx,
        numPredict: r.num_predict,
        temperature: r.temperature,
        repeatPenalty: r.repeat_penalty,
        topK: r.top_k,
        topP: r.top_p,
    });
}
// ── Contexto de mensagens ───────────────────────────────────
function construirContexto(messages, compreensao, r) {
    const historico = messages.filter((m) => m.role !== 'system');
    const queryEmbed = compreensao?.embed ?? [];
    if (!queryEmbed.length) {
        return historico.slice(-r.memoriaContextoMax);
    }
    const kSemantico = Math.ceil(r.memoriaContextoMax * 0.6);
    const kRecente = Math.floor(r.memoriaContextoMax * 0.4);
    const semanticos = (0, embed_1.buscarMensagensSimilares)(queryEmbed, historico, kSemantico);
    const recentes = historico.slice(-kRecente);
    const vistos = new Set();
    const combined = [...semanticos, ...recentes].filter((m) => {
        if (vistos.has(m))
            return false;
        vistos.add(m);
        return true;
    });
    return historico.filter((m) => combined.includes(m));
}
function routeByMode(compreensao, modoManual) {
    // modo manual override tudo
    if (modoManual === 'online')
        return 'online';
    return 'local';
}
async function dispatchAgente(input) {
    const { messages, onToken, hw, modo, topico, input: userInput, nicho, } = input;
    // Nicho geral → agenteTeo
    if (nicho === 'geral') {
        return (0, agenteTeo_1.agenteTeo)({
            messages,
            onToken,
            hw,
            modo,
            topico,
            input: userInput,
            trainerContext: input.trainerContext,
            nicho,
            ...(input.onEtapa ? { onEtapa: input.onEtapa } : {}),
        });
    }
    // Nicho programação + modelo especialista → agenteProgramacao
    if (nicho === 'programacao' && aios_1.TEO.agenteCodigoModel) {
        return (0, agenteProgramacao_1.agenteProgramacao)({
            messages,
            onToken,
            trainerContext: input.trainerContext ?? '',
            hw,
            modo,
            topico,
            input: userInput,
            ...(input.onEtapa ? { onEtapa: input.onEtapa } : {}),
        });
    }
    // Fallback: LLM direto
    return callDirectLLM(input);
}
// ── LLM direto ───────────────────────────────────────────────
async function callDirectLLM(input) {
    const { messages, onToken, hw, modo, trainerContext } = input;
    const systemContent = trainerContext
        ? `${prompt_1.SYSTEM_PROMPT.content}\n\n## Contexto do Trainer\n${trainerContext}`
        : prompt_1.SYSTEM_PROMPT.content;
    const llm = buildLLM(hw, modo);
    const contextMsgs = messages.filter((m) => m.role !== 'system');
    const lcMessages = [
        new messages_1.SystemMessage(systemContent),
        ...contextMsgs.map((m) => m.role === 'user'
            ? new messages_1.HumanMessage(m.content)
            : new messages_1.AIMessage(m.content)),
    ];
    let resposta = '';
    const stream = await llm.stream(lcMessages);
    for await (const chunk of stream) {
        const token = typeof chunk.content === 'string' ? chunk.content : '';
        if (token) {
            onToken(token);
            resposta += token;
        }
    }
    return { resposta, modelo: aios_1.TEO.modelo };
}
//# sourceMappingURL=nodes.js.map