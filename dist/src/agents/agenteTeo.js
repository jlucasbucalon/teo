"use strict";
// ============================================================
//  TEO — src/agents/agenteTeo.ts
//  Interface principal do Sistema Operacional
//  TEO responde como JARVIS — conhecendo o contexto completo
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.agenteTeo = agenteTeo;
const ollama_1 = require("@langchain/ollama");
const messages_1 = require("@langchain/core/messages");
const aios_1 = require("../aios");
const reasoning_1 = require("../core/reasoning");
const prompt_1 = require("../codex/prompt");
// ── Agente ───────────────────────────────────────────────────
async function agenteTeo(input) {
    const modelo = aios_1.TEO.modelo;
    const r = (0, reasoning_1.obterRaciocinio)(input.modo, input.hw);
    const systemContent = prompt_1.SYSTEM_PROMPT.content;
    // ── LLM call ───────────────────────────────────────────────
    const llm = new ollama_1.ChatOllama({
        baseUrl: aios_1.TEO.ollamaUrl,
        model: modelo,
        numThread: input.hw.params.num_thread,
        numGpu: input.hw.params.num_gpu,
        keepAlive: -1,
        numBatch: (0, reasoning_1.numBatch)(input.hw),
        numCtx: r.num_ctx,
        numPredict: r.num_predict,
        temperature: r.temperature,
        repeatPenalty: r.repeat_penalty,
        topK: r.top_k,
        topP: r.top_p,
    });
    const lcMessages = [
        new messages_1.SystemMessage(systemContent),
        ...input.messages
            .filter((m) => m.role !== 'system')
            .map((m) => m.role === 'user'
            ? new messages_1.HumanMessage(m.content)
            : new messages_1.AIMessage(m.content)),
    ];
    input.onEtapa?.({ tipo: 'respondendo' });
    let resposta = '';
    try {
        const stream = await llm.stream(lcMessages);
        for await (const chunk of stream) {
            const token = typeof chunk.content === 'string'
                ? chunk.content
                : '';
            if (token) {
                input.onToken(token);
                resposta += token;
            }
        }
    }
    catch (err) {
        for (let tentativa = 1; tentativa <= 3; tentativa++) {
            await new Promise((res) => setTimeout(res, tentativa * 1000));
            try {
                const stream = await llm.stream(lcMessages);
                for await (const chunk of stream) {
                    const token = typeof chunk.content === 'string'
                        ? chunk.content
                        : '';
                    if (token) {
                        input.onToken(token);
                        resposta += token;
                    }
                }
                break;
            }
            catch {
                /* retry */
            }
        }
    }
    return { resposta: resposta.trim(), modelo };
}
//# sourceMappingURL=agenteTeo.js.map