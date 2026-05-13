#!/usr/bin/env node
"use strict";
// ============================================================
//  TEO — src/terminal/cli.ts
//  Interface de linha de comando
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const aios_1 = require("../aios");
const teo_1 = require("../teo");
const ui_1 = require("./ui");
const reasoning_1 = require("../core/reasoning");
const understand_1 = require("../core/understand");
const agenteTrainer_1 = require("../agents/agenteTrainer");
const chatModule = __importStar(require("../chat/modules"));
const { interpretar, estado: chatEstado, carregarMemoria, salvarMemoria, gerarChatId, criarChat,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
 } = chatModule;
// ── Histórico em memória (sem chat aberto) ───────────────────
let memoryHistory = [];
// ── Readline ─────────────────────────────────────────────────
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
// ── Histórico ativo ──────────────────────────────────────────
function getHistory() {
    if (chatEstado.chatAtual) {
        return (carregarMemoria(chatEstado.chatAtual) ?? []);
    }
    return memoryHistory;
}
async function saveHistory(history) {
    if (chatEstado.chatAtual) {
        await salvarMemoria(chatEstado.chatAtual, history);
    }
    else {
        memoryHistory = history;
    }
}
// ── Conversa com LLM ─────────────────────────────────────────
async function perguntar(input) {
    // Auto-cria chat se nenhum estiver aberto
    if (!chatEstado.chatAtual) {
        const novoId = gerarChatId();
        criarChat(novoId);
        (0, ui_1.printInfo)(`chat ${novoId} criado  —  use "teo fechar chat" para encerrar`);
    }
    const history = getHistory();
    history.push({ role: 'user', content: input });
    await saveHistory(history);
    const inicio = Date.now();
    (0, ui_1.startSpinner)(aios_1.TEO.modelo);
    let primeiroToken = true;
    try {
        const { resposta } = await (0, teo_1.teoChat)(history, (token) => {
            if (primeiroToken) {
                (0, ui_1.stopSpinner)();
                (0, ui_1.printStreamHeader)(aios_1.TEO.modelo, (0, reasoning_1.getModo)());
                primeiroToken = false;
            }
            process.stdout.write(token);
        }, chatEstado.chatAtual ?? null, { compreensao: null, trainerContext: null });
        if (primeiroToken)
            (0, ui_1.stopSpinner)();
        (0, ui_1.printStreamEnd)(Date.now() - inicio);
        history.push({ role: 'assistant', content: resposta });
        await saveHistory(history);
        // Fire-and-forget — classifica e treina APÓS a resposta
        if (aios_1.TEO.trainerKey) {
            const chatId = chatEstado.chatAtual ?? null;
            (0, understand_1.entender)(input, chatId)
                .then((compreensao) => (0, agenteTrainer_1.treinarNicho)({
                nicho: compreensao.nicho,
                topico: compreensao.topico,
                input,
                resposta,
                chatId,
            }))
                .catch((err) => console.error('[trainer erro]', err?.message ?? String(err)));
        }
    }
    catch (err) {
        (0, ui_1.stopSpinner)();
        const msg = err instanceof Error
            ? err.message
            : 'erro desconhecido';
        (0, ui_1.printError)(msg);
    }
}
// ── Loop principal ────────────────────────────────────────────
function loop() {
    rl.question((0, ui_1.formatPrompt)(chatEstado.chatAtual), async (input) => {
        const texto = input.trim();
        if (!texto)
            return loop();
        const t = texto.toLowerCase();
        // Modo de raciocínio
        const modoMatch = t.match(/^teo modo (local|local|online)$/);
        if (modoMatch) {
            const arg = modoMatch[1] === 'local' ? 'local' : modoMatch[1];
            if ((0, reasoning_1.setModo)(arg))
                (0, ui_1.printModo)(arg);
            else
                (0, ui_1.printInfo)('Use: teo modo local  ou  teo modo online');
            return loop();
        }
        // Histórico de conversa
        if ([
            'teo historico',
            'teo histórico',
            'teo history',
        ].includes(t)) {
            const hist = getHistory();
            if (hist.length === 0) {
                (0, ui_1.printReset)();
            }
            else {
                hist.forEach((m, i) => (0, ui_1.printInfo)(`[${i + 1}] ${m.role}: ${String(m.content).slice(0, 80)}...`));
            }
            return loop();
        }
        // Status do sistema
        if (['teo status', 'teo estado', 'teo info'].includes(t)) {
            const chat = chatEstado.chatAtual
                ? `Chat: ${chatEstado.chatAtual}`
                : 'Sem chat aberto';
            (0, ui_1.printInfo)(`TEO operacional  |  modo: ${(0, reasoning_1.getModo)()}  |  ${chat}  |  modelo: ${aios_1.TEO.modelo}`);
            return loop();
        }
        // Comandos de chat (criar/abrir/fechar/listar/etc.) e demais comandos
        const resultadoChat = await interpretar(texto);
        if (resultadoChat !== null) {
            if (resultadoChat === '__sair__') {
                (0, ui_1.printExit)();
                process.exit(0);
            }
            (0, ui_1.printResponse)({
                texto: resultadoChat,
                modelo: 'TEO',
                modo: 'cmd',
            });
            return loop();
        }
        // LLM
        await perguntar(texto);
        loop();
    });
}
loop();
//# sourceMappingURL=cli.js.map