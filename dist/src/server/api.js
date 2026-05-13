"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const aios_1 = require("../aios");
const teo_1 = require("../teo");
// ── Servidor ─────────────────────────────────────────────────
function createServer() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // ── Health check ─────────────────────────────────────────
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', modelo: aios_1.TEO.modelo });
    });
    // ── Chat handler ─────────────────────────────────────────
    const chatHandler = async (req, res) => {
        const { messages, chatId } = req.body;
        // Validação
        if (!Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({
                error: 'messages deve ser um array não vazio',
            });
            return;
        }
        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const chunkBase = {
            id: `chatcmpl-teo-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: aios_1.TEO.modelo,
        };
        // início do stream (role)
        res.write(`data: ${JSON.stringify({
            ...chunkBase,
            choices: [
                {
                    index: 0,
                    delta: { role: 'assistant' },
                    finish_reason: null,
                },
            ],
        })}\n\n`);
        try {
            // ── CORE ÚNICO (TEO BRAIN) — streaming real ────────────
            await (0, teo_1.teoChat)(messages, (token) => {
                res.write(`data: ${JSON.stringify({
                    ...chunkBase,
                    choices: [
                        {
                            index: 0,
                            delta: { content: token },
                            finish_reason: null,
                        },
                    ],
                })}\n\n`);
            }, chatId ?? null);
            // fim
            res.write(`data: ${JSON.stringify({
                ...chunkBase,
                choices: [
                    {
                        index: 0,
                        delta: {},
                        finish_reason: 'stop',
                    },
                ],
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }
        catch (error) {
            const msg = error instanceof Error
                ? error.message
                : 'Erro desconhecido';
            console.error('TEO ERROR:', msg);
            res.write(`data: ${JSON.stringify({
                ...chunkBase,
                choices: [
                    {
                        index: 0,
                        delta: { content: `\n\n[Erro: ${msg}]` },
                        finish_reason: 'stop',
                    },
                ],
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }
    };
    // Rotas compatíveis com OpenAI
    app.post('/v1/chat/completions', chatHandler);
    app.post('/chat/completions', chatHandler);
    return app;
}
//# sourceMappingURL=api.js.map