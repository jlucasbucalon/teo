"use strict";
// ============================================================
//  TEO — src/agents/agenteProgramacao.ts
//  Agente especializado em programação.
//  Fluxo fixo (sem tool calling via LLM):
//    1. lerNicho / lerContextoFocado → carrega seções relevantes do .md
//    2. buscaWeb  → busca informações atuais (condicional por modo)
//    3. Injeta contexto no system prompt
//    4. ChatOllama stream → resposta final
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.agenteProgramacao = agenteProgramacao;
const ollama_1 = require("@langchain/ollama");
const messages_1 = require("@langchain/core/messages");
const aios_1 = require("../aios");
const buscaWeb_1 = require("../tools/buscaWeb");
const lerVector_1 = require("../tools/lerVector");
const reasoning_1 = require("../core/reasoning");
const prompt_1 = require("../codex/prompt");
// ── Contexto adicional de programação ───────────────────────
const CONTEXTO_PROGRAMACAO = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESPECIALIZAÇÃO: PROGRAMAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Neste contexto você atua como especialista em programação e desenvolvimento de software.

Você recebe dois contextos de referência para responder:
1. Conhecimento acumulado do nicho (.md) — base interna já aprendida
2. Informações atuais da web — dados recentes sobre o assunto

PRIORIDADE DAS FONTES (sempre nesta ordem):
1. Informações da web (mais recentes)
2. Conhecimento do nicho (.md)
3. Seu conhecimento base

Quando usar informação da web, indique a fonte no final: (fonte: web — [título])`;
// ── Agente ───────────────────────────────────────────────────
async function agenteProgramacao(input) {
    const modelo = aios_1.TEO.agenteCodigoModel ?? aios_1.TEO.modelo;
    const r = (0, reasoning_1.obterRaciocinio)(input.modo, input.hw);
    // ── Passo 1: lê o conhecimento acumulado (.md) ───────────
    input.onEtapa?.({
        tipo: 'lendo_conhecimento',
        nicho: 'programacao',
    });
    console.log('[agenteProgramacao] Lendo conhecimento acumulado...');
    const conhecimento = await (0, lerVector_1.lerNicho)('programacao');
    const temConhecimento = conhecimento.temConhecimento;
    console.log(`[agenteProgramacao] Conhecimento: ${temConhecimento ? 'carregado' : 'vazio'}`);
    // Retorna só as seções relevantes para este input
    const contextoFocado = temConhecimento
        ? await (0, lerVector_1.lerContextoFocado)('programacao', input.input, 3)
        : '';
    // ── Passo 2: busca web condicional por modo ───────────────
    const partes = [
        prompt_1.SYSTEM_PROMPT.content,
        CONTEXTO_PROGRAMACAO,
    ];
    if (contextoFocado) {
        partes.push(`\n${contextoFocado}`);
    }
    const decisao = (0, buscaWeb_1.decidirBusca)(input.modo);
    console.log(`[agenteProgramacao] Busca web: ${decisao.buscar ? 'sim' : 'não'} (modo=${input.modo})`);
    if (decisao.buscar) {
        input.onEtapa?.({
            tipo: 'buscando_web',
            query: input.input, // ← era input.topico
        });
        console.log(`[agenteProgramacao] Buscando: "${input.input}"` // ← era input.topico
        );
        const webResult = await (0, buscaWeb_1.buscaWeb)(input.input, // ← era input.topico
        decisao.maxResultados, 'programacao');
        console.log(`[agenteProgramacao] Resultados web: ${webResult.resultados.length}`);
        if (webResult.resultados.length > 0) {
            const webTexto = webResult.resultados
                .map((r) => `### ${r.title}\nURL: ${r.url}\n${r.content}`)
                .join('\n\n');
            partes.push(`\n## Informações Atuais da Web\n${webTexto}`);
        }
    }
    if (input.trainerContext.trim()) {
        partes.push(`\n## Contexto Adicional\n${input.trainerContext}`);
    }
    const systemContent = partes.join('\n');
    // ── Passo 3: chama o modelo com contexto completo ────────
    const llm = new ollama_1.ChatOllama({
        baseUrl: aios_1.TEO.ollamaUrl,
        model: modelo,
        numThread: input.hw.params.num_thread,
        numGpu: input.hw.params.num_gpu,
        keepAlive: -1,
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
    const stream = await llm.stream(lcMessages);
    for await (const chunk of stream) {
        const token = typeof chunk.content === 'string' ? chunk.content : '';
        if (token) {
            input.onToken(token);
            resposta += token;
        }
    }
    return { resposta: resposta.trim(), modelo };
}
//# sourceMappingURL=agenteProgramacao.js.map