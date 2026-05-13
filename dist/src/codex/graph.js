"use strict";
// ============================================================
//  TEO — src/core/graph.ts
//  Pipeline LangGraph — orquestra compreensão e resposta
//
//  Fluxo:
//    START → understand → (roteamento por modo)
//              ├── respond_local   (modo local)
//              └── respond_profundo (modo profundo)
//            → END
//
//  Nodes extraídos para: src/core/graph/nodes.ts
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTeoGraph = runTeoGraph;
const langgraph_1 = require("@langchain/langgraph");
const understand_1 = require("../core/understand");
const reasoning_1 = require("../core/reasoning");
const nodes_1 = require("./nodes");
const agenteProgramacao_1 = require("../agents/agenteProgramacao");
const agenteTeo_1 = require("../agents/agenteTeo");
const aios_1 = require("../aios");
const kernel_1 = require("./kernel");
// ── Estado do grafo ──────────────────────────────────────────
const TeoState = langgraph_1.Annotation.Root({
    messages: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => [],
    }),
    chatId: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => null,
    }),
    hw: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => null,
    }),
    onToken: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => null,
    }),
    compreensao: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => null,
    }),
    trainerContext: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => null,
    }),
    resposta: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => '',
    }),
    modeloUsado: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => '',
    }),
    onEtapa: (0, langgraph_1.Annotation)({
        reducer: (_, y) => y,
        default: () => null,
    }),
});
// ── Nó: understand ────────────────────────────────────────────
async function understandNode(state) {
    if (state.compreensao !== null)
        return {};
    const lastMsg = [...state.messages]
        .reverse()
        .find((m) => m.role === 'user');
    if (!lastMsg)
        return {};
    const compreensao = (0, understand_1.classificarRapido)(lastMsg.content);
    return { compreensao };
}
// ── Roteamento ────────────────────────────────────────────────
function routeNode(state) {
    return (0, nodes_1.routeByMode)(state.compreensao, (0, reasoning_1.getModo)());
}
// ── Nó: respond ───────────────────────────────────────────────
async function respondNode(state, modo) {
    const hw = state.hw;
    const r = (0, reasoning_1.obterRaciocinio)(modo, hw);
    const onToken = state.onToken ?? (() => undefined);
    const contextMsgs = (0, nodes_1.construirContexto)(state.messages, state.compreensao, r);
    const ultimaMsgUsuario = [...contextMsgs]
        .reverse()
        .find((m) => m.role === 'user')?.content ?? '';
    const topico = state.compreensao?.topico ?? ultimaMsgUsuario;
    // Build contexto operacional UNA única vez
    const trainerContext = await (0, kernel_1.buildSystemContext)();
    // Dispatch para agente especializado
    if (state.compreensao?.nicho === 'geral') {
        const { resposta, modelo } = await (0, agenteTeo_1.agenteTeo)({
            messages: contextMsgs,
            onToken,
            hw,
            modo,
            topico,
            input: ultimaMsgUsuario,
            trainerContext,
            nicho: state.compreensao?.nicho,
            ...(state.onEtapa ? { onEtapa: state.onEtapa } : {}),
        });
        return { resposta, modeloUsado: modelo };
    }
    if (state.compreensao?.nicho === 'programacao' &&
        aios_1.TEO.agenteCodigoModel) {
        const { resposta, modelo } = await (0, agenteProgramacao_1.agenteProgramacao)({
            messages: contextMsgs,
            onToken,
            trainerContext,
            hw,
            modo,
            topico,
            input: ultimaMsgUsuario,
            ...(state.onEtapa ? { onEtapa: state.onEtapa } : {}),
        });
        return { resposta, modeloUsado: modelo };
    }
    // Fallback: LLM direto
    const llm = (0, nodes_1.buildLLM)(hw, modo);
    let resposta = '';
    const stream = await llm.stream(contextMsgs
        .filter((m) => m.role !== 'system')
        .map((m) => m.role === 'user'
        ? { role: 'user', content: m.content }
        : {
            role: 'assistant',
            content: m.content,
        }));
    for await (const chunk of stream) {
        const token = typeof chunk.content === 'string' ? chunk.content : '';
        if (token) {
            onToken(token);
            resposta += token;
        }
    }
    return { resposta, modeloUsado: aios_1.TEO.modelo };
}
// ── Grafo compilado ──────────────────────────────────────────
const teoGraph = new langgraph_1.StateGraph(TeoState)
    .addNode('understand', understandNode)
    .addNode('respond_local', (s) => respondNode(s, 'local'))
    .addNode('respond_online', (s) => respondNode(s, 'online'))
    .addEdge(langgraph_1.START, 'understand')
    .addConditionalEdges('understand', routeNode, {
    local: 'respond_local',
    online: 'respond_online',
})
    .addEdge('respond_local', langgraph_1.END)
    .addEdge('respond_online', langgraph_1.END)
    .compile();
async function runTeoGraph(input) {
    const result = await teoGraph.invoke({
        messages: input.messages,
        chatId: input.chatId,
        hw: input.hw,
        onToken: input.onToken,
        compreensao: input.compreensao ?? null,
        trainerContext: input.trainerContext ?? null,
        onEtapa: input.onEtapa ?? null,
        resposta: '',
    });
    return {
        resposta: result.resposta,
        compreensao: result.compreensao,
        modeloUsado: result.modeloUsado,
    };
}
//# sourceMappingURL=graph.js.map