"use strict";
// ============================================================
//  TEO — src/system/reasoning.ts
//  Modos de raciocínio — controla QUANTO o modelo pensa.
//
//  HARDWARE: ambos os modos usam 100% do hardware disponível.
//    numThread = todos os núcleos da CPU
//    numGpu    = todos os layers na GPU (999 = dedicada)
//    keepAlive = -1 (modelo sempre carregado)
//
//  O que muda entre os modos é APENAS o comportamento do LLM:
//    local    → contexto médio, tokens limitados, foco em velocidade
//    online → contexto máximo, tokens ilimitados, raciocínio completo
//
//  O contexto (num_ctx) é calculado a partir do hardware:
//    VRAM disponível → domina quando há GPU dedicada
//    RAM livre       → fallback para CPU-only
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.obterRaciocinio = obterRaciocinio;
exports.getModo = getModo;
exports.setModo = setModo;
exports.numBatch = numBatch;
exports.relatorioRaciocinio = relatorioRaciocinio;
// ── Contexto máximo baseado em hardware ─────────────────────
//
// VRAM domina quando há GPU — ela armazena o modelo + KV-cache.
// RAM é usada quando a GPU é ausente ou insuficiente.
//
// Referência empírica para modelos 7-8B (q4_K_M ~4GB):
//   12GB VRAM → ~8GB livre para KV-cache → ~65k context
//    8GB VRAM → ~4GB livre para KV-cache → ~32k context
//    6GB VRAM → ~2GB livre              → ~16k context
//    4GB VRAM → ~512MB livre            → ~8k context
function ctxMaximo(ram, vramGB) {
    if (vramGB >= 12)
        return 65536;
    if (vramGB >= 8)
        return 32768;
    if (vramGB >= 6)
        return 16384;
    if (vramGB >= 4)
        return 8192;
    // CPU-only ou VRAM muito pequena: escala pela RAM livre
    if (ram.livreGB >= 16)
        return 8192;
    if (ram.livreGB >= 8)
        return 4096;
    if (ram.livreGB >= 4)
        return 2048;
    return 1024;
}
// ── Modo Local ──────────────────────────────────────────────
// Hardware: 100% (igual ao online).
// LLM: contexto em 50% do máximo + tokens limitados.
// Objetivo: respostas rápidas para dúvidas e comandos comuns.
function modoLocal(ram, vramGB) {
    const ctxMax = ctxMaximo(ram, vramGB);
    const num_ctx = Math.floor(ctxMax / 2);
    return {
        nome: 'local',
        num_ctx,
        num_predict: 2048, // suficiente para respostas técnicas completas
        temperature: 0.5,
        repeat_penalty: 1.1,
        top_k: 20,
        top_p: 0.8,
        memoriaContextoMax: 20,
    };
}
// ── Modo Profundo ────────────────────────────────────────────
// Hardware: 100% (igual ao rápido).
// LLM: contexto máximo + tokens ilimitados.
// Objetivo: análises, código complexo, raciocínio longo.
function modoProfundo(ram, vramGB) {
    const num_ctx = ctxMaximo(ram, vramGB);
    return {
        nome: 'online',
        num_ctx,
        num_predict: -1,
        temperature: 0.7,
        repeat_penalty: 1.1,
        top_k: 40,
        top_p: 0.9,
        memoriaContextoMax: Math.floor(num_ctx / 400),
    };
}
// ── Seletor ──────────────────────────────────────────────────
function obterRaciocinio(modo, hw) {
    const vramGB = hw.gpu.tipo !== 'cpu' ? hw.gpu.vramGB : 0;
    return modo === 'local'
        ? modoLocal(hw.ram, vramGB)
        : modoProfundo(hw.ram, vramGB);
}
// ── Estado global do modo atual ──────────────────────────────
let modoAtual = 'local';
function getModo() {
    return modoAtual;
}
function setModo(novo) {
    if (novo === 'local' || novo === 'online') {
        modoAtual = novo;
        return true;
    }
    return false;
}
// ── numBatch: tamanho do batch para Ollama ─────────────────────
// Compatível com buildLLM e com agentes que usam ChatOllama direto.
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
// ── Relatório legível ────────────────────────────────────────
function relatorioRaciocinio(r) {
    return [
        `Modo     : ${r.nome}`,
        `Contexto : ${r.num_ctx} tokens`,
        `Tokens   : ${r.num_predict === -1 ? 'sem limite' : r.num_predict}`,
        `Histórico: ${r.memoriaContextoMax} mensagens`,
    ].join('\n');
}
//# sourceMappingURL=reasoning.js.map