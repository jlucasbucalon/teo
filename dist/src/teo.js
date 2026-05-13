"use strict";
// ============================================================
//  TEO — src/core/teo.ts
//  AI central — orquestrador LangGraph + memória persistente
//
//  Usa carregarMemoria/salvarMemoria de chat/modules.ts para
//  evitar duplicação de lógica de histórico.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.inicializarHardware = inicializarHardware;
exports.invalidarCacheHardware = invalidarCacheHardware;
exports.teoChat = teoChat;
const aios_1 = require("./aios");
const hardware_1 = require("./system/hardware");
const remoteHardware_1 = require("./system/remoteHardware");
const ui_js_1 = require("./terminal/ui.js");
const graph_1 = require("./codex/graph");
const embed_1 = require("./core/embed");
const modules_1 = require("./chat/modules");
const _cache = {
    local: null,
    remoto: null,
};
const HW_TTL_MS = 5 * 60 * 1000; // 5 minutos
function ehRemota(url) {
    return (!url.includes('localhost') &&
        !url.includes('127.0.0.1') &&
        !url.includes('::1'));
}
function getHwFresco() {
    const cache = ehRemota(aios_1.TEO.ollamaUrl)
        ? _cache.remoto
        : _cache.local;
    if (cache && Date.now() - cache.timestamp < HW_TTL_MS)
        return cache.hw;
    return null;
}
async function inicializarHardware() {
    const fresco = getHwFresco();
    if (fresco)
        return;
    if (ehRemota(aios_1.TEO.ollamaUrl)) {
        const hwRemoto = await (0, remoteHardware_1.detectarHardwareRemoto)(aios_1.TEO.ollamaUrl);
        (0, ui_js_1.printHardware)((0, remoteHardware_1.relatorioHardwareRemoto)(hwRemoto));
        _cache.remoto = { hw: hwRemoto, timestamp: Date.now() };
    }
    else {
        const hw = (0, hardware_1.detectarHardware)();
        (0, ui_js_1.printHardware)((0, hardware_1.relatorioHardware)(hw));
        _cache.local = { hw, timestamp: Date.now() };
    }
}
function getHw() {
    return getHwFresco() ?? (0, hardware_1.detectarHardware)();
}
function invalidarCacheHardware() {
    _cache.local = null;
    _cache.remoto = null;
}
async function teoChat(messages, onToken, chatId, options, onEtapa) {
    const hw = getHw();
    const id = chatId ?? null;
    // Carrega histórico via modules.ts (fonte única)
    const historicoCompleto = id ? (0, modules_1.carregarMemoria)(id) : [];
    const userMsg = messages
        .filter((m) => m.role === 'user')
        .at(-1);
    const jaExiste = userMsg
        ? historicoCompleto.some((m) => m.role === 'user' && m.content === userMsg.content)
        : true;
    if (!jaExiste && userMsg) {
        historicoCompleto.push({
            ...userMsg,
            embed: userMsg.embed ?? [],
        });
    }
    // Resolve opcionais
    const preCompreensao = options?.compreensao !== undefined
        ? options.compreensao
        : null;
    const trainerCtx = options?.trainerContext !== undefined
        ? options.trainerContext
        : null;
    const { resposta, compreensao, modeloUsado } = await (0, graph_1.runTeoGraph)({
        messages: historicoCompleto,
        onToken,
        chatId: id,
        hw,
        compreensao: preCompreensao,
        trainerContext: trainerCtx,
        onEtapa: onEtapa ?? null,
    });
    // Persiste via modules.ts — embed da resposta com timeout
    if (id && resposta) {
        const memoriaAtualizada = (0, modules_1.carregarMemoria)(id);
        const ultimaUser = messages.find((m) => m.role === 'user');
        if (ultimaUser) {
            const tem = memoriaAtualizada.some((m) => m.role === 'user' &&
                m.content === ultimaUser.content);
            if (!tem) {
                memoriaAtualizada.push({
                    ...ultimaUser,
                    embed: compreensao?.embed ?? [],
                });
            }
        }
        // Embed da resposta com timeout de 3s — não bloqueia se falhar
        const embedPromise = (0, embed_1.embedTexto)(resposta).catch(() => []);
        const timeout = new Promise((resolve) => setTimeout(() => resolve([]), 3000));
        const assistantEmbed = await Promise.race([
            embedPromise,
            timeout,
        ]);
        memoriaAtualizada.push({
            role: 'assistant',
            content: resposta,
            embed: assistantEmbed,
        });
        await (0, modules_1.salvarMemoria)(id, memoriaAtualizada);
    }
    return { resposta, compreensao, modeloUsado };
}
//# sourceMappingURL=teo.js.map