"use strict";
// ============================================================
//  TEO — src/agents/agenteTrainer.ts
//  Agente de treinamento — enriquece os .md dos nichos após
//  cada interação via tool calling (Anthropic/Ollama) ou
//  prompt único (Gemini).
//
//  Melhorias:
//    - Prompt genérico para qualquer nicho
//    - Avaliação da qualidade da resposta do TEO
//    - Identificação de gaps no .md
//    - Subseções dinâmicas por assunto
//    - Log do trainer (sucesso, sem alteração, erro)
//    - Resposta completa sem truncamento
//    - Fire-and-forget — nunca bloqueia o usuário
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.treinarNicho = treinarNicho;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const aios_1 = require("../aios");
const buscaWeb_1 = require("../tools/buscaWeb");
const lerVector_1 = require("../tools/lerVector");
const escreverVector_1 = require("../tools/escreverVector");
const prompt_1 = require("../codex/prompt");
// ── Log do trainer ────────────────────────────────────────────
const LOG_DIR = path_1.default.resolve(__dirname, '../../src/memory');
const LOG_FILE = path_1.default.join(LOG_DIR, 'trainer.log');
function logTrainer(nicho, status, detalhe) {
    try {
        if (!fs_1.default.existsSync(LOG_DIR)) {
            fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
        }
        const timestamp = new Date().toLocaleString('pt-BR');
        const linha = `[${timestamp}] [${nicho}] ${status}${detalhe ? ` — ${detalhe}` : ''}\n`;
        fs_1.default.appendFileSync(LOG_FILE, linha, 'utf8');
    }
    catch {
        // Log silencioso — nunca interrompe o trainer
    }
}
// ── System prompt ────────────────────────────────────────────
const UNIVERSAL_TEO = prompt_1.SYSTEM_PROMPT.content;
const TRAINER_PROMPT = `Você é o TEO Trainer — sua função é enriquecer o conhecimento do TEO sobre nichos específicos.

Você recebe uma interação do chat, o nicho identificado e o conteúdo atual do arquivo de conhecimento.
Seu trabalho é analisar, avaliar e decidir se há algo genuinamente novo para adicionar.

PROCESSO OBRIGATÓRIO:
1. Leia o conteúdo atual do nicho (fornecido abaixo)
2. Avalie a resposta do TEO: estava correta e completa? Se não, identifique o que precisa ser corrigido
3. Identifique gaps: o que foi perguntado que NÃO está no .md ainda?
4. Se há conhecimento novo ou correção necessária → atualize o .md
5. Se o conteúdo já existe e está correto → retorne SEM_ALTERACAO

REGRAS DE ESCRITA:
- Escreva sobre o ASSUNTO/NICHO — nunca sobre o usuário
- Crie subseções específicas por assunto dentro do nicho:
  Exemplo: "## Node.js — Criação de servidores HTTP"
  Exemplo: "## Diabetes — Sintomas e diagnóstico"
  Exemplo: "## Marketing Digital — SEO on-page"
- Adicione apenas conhecimento técnico, preciso e verificável
- Preserve TODO o conteúdo já existente no .md
- Não repita informações que já estão no arquivo
- Corrija informações incorretas se identificar
- Seja objetivo e técnico — sem opiniões ou suposições

FORMATO DA RESPOSTA:
- Se há alteração: retorne o arquivo .md COMPLETO e atualizado
- Se não há nada novo: retorne exatamente a string SEM_ALTERACAO
- Nunca retorne explicações, comentários ou markdown extra além do .md`;
const SYSTEM_PROMPT = UNIVERSAL_TEO + '\n\n' + TRAINER_PROMPT;
// ── Ferramentas (Anthropic/Ollama) ────────────────────────────
const TOOLS = [
    {
        name: 'buscar_web',
        description: 'Busca informações atuais na internet para verificar, corrigir ou enriquecer o conhecimento do nicho. Use quando identificar gaps ou informações que podem estar desatualizadas.',
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Termos de busca específicos e relevantes para o assunto',
                },
                max_resultados: {
                    type: 'number',
                    description: 'Máximo de resultados (padrão 3)',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'atualizar_nicho',
        description: 'Escreve o arquivo .md completo e atualizado com o novo conhecimento. Use apenas se tiver algo genuinamente novo ou uma correção necessária.',
        input_schema: {
            type: 'object',
            properties: {
                nicho: {
                    type: 'string',
                    description: 'ID do nicho (ex: programacao, saude, negocios)',
                },
                conteudo: {
                    type: 'string',
                    description: 'Conteúdo COMPLETO e atualizado do arquivo .md',
                },
            },
            required: ['nicho', 'conteudo'],
        },
    },
];
// ── Execução de ferramentas ───────────────────────────────────
async function executarFerramenta(nome, input) {
    try {
        switch (nome) {
            case 'buscar_web': {
                const resultado = await (0, buscaWeb_1.buscaWeb)(input.query, input.max_resultados ?? 3);
                return JSON.stringify(resultado);
            }
            case 'atualizar_nicho': {
                (0, escreverVector_1.escreverNicho)(input.nicho, input.conteudo);
                return JSON.stringify({ sucesso: true });
            }
            default:
                return JSON.stringify({
                    erro: 'Ferramenta desconhecida',
                });
        }
    }
    catch (err) {
        return JSON.stringify({
            erro: err instanceof Error
                ? err.message
                : 'Erro na ferramenta',
        });
    }
}
// ── Helpers ──────────────────────────────────────────────────
function detectarProvider(url) {
    if (url.includes('googleapis.com'))
        return 'gemini';
    if (url.includes('anthropic.com'))
        return 'anthropic';
    return 'ollama';
}
/**
 * Monta o prompt com contexto completo para o trainer.
 * Inclui o conteúdo atual do .md para o trainer avaliar gaps.
 */
async function montarPrompt(params, conteudoAtual) {
    return `NICHO: ${params.nicho}
TÓPICO: ${params.topico}
DATA: ${new Date().toLocaleString('pt-BR')}

INTERAÇÃO DO CHAT:
Usuário perguntou: ${params.input}
TEO respondeu: ${params.resposta}

CONTEÚDO ATUAL DO ARQUIVO DE CONHECIMENTO (${params.nicho}.md):
${conteudoAtual || '_arquivo vazio — criar do zero_'}

Analise a interação acima e siga o processo obrigatório descrito.`;
}
// ── Loop de tool calling (Anthropic + Ollama) ────────────────
async function runAnthropicLoop(client, model, prompt, nicho) {
    const messages = [
        { role: 'user', content: prompt },
    ];
    let atualizado = false;
    const inicio = Date.now();
    const TIMEOUT = 60_000;
    while (Date.now() - inicio < TIMEOUT) {
        const response = await client.messages.create({
            model,
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
        });
        messages.push({
            role: 'assistant',
            content: response.content,
        });
        if (response.stop_reason !== 'tool_use')
            break;
        const toolUses = response.content.filter((b) => b.type === 'tool_use');
        const toolResults = [];
        for (const toolUse of toolUses) {
            const resultado = await executarFerramenta(toolUse.name, toolUse.input);
            if (toolUse.name === 'atualizar_nicho')
                atualizado = true;
            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: resultado,
            });
        }
        messages.push({ role: 'user', content: toolResults });
    }
    if (atualizado) {
        logTrainer(nicho, 'atualizado');
    }
    else {
        logTrainer(nicho, 'sem_alteracao');
    }
    return { ok: true, nicho, atualizado };
}
// ── Prompt único (Gemini) ────────────────────────────────────
async function runGemini(params, conteudoAtual) {
    const promptCompleto = await montarPrompt(params, conteudoAtual);
    const prompt = `${SYSTEM_PROMPT}

${promptCompleto}

INSTRUÇÃO FINAL:
- Se há conhecimento novo ou correção: retorne o arquivo .md COMPLETO e atualizado
- Se não há nada novo: retorne exatamente a string SEM_ALTERACAO
- Não inclua explicações, comentários ou texto além do .md`;
    const url = `${aios_1.TEO.trainerUrl}/models/${aios_1.TEO.trainerModel}:generateContent?key=${aios_1.TEO.trainerKey}`;
    const response = await axios_1.default.post(url, { contents: [{ parts: [{ text: prompt }] }] }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60_000,
    });
    const resposta = response.data?.candidates?.[0]?.content?.parts?.[0]
        ?.text;
    if (!resposta) {
        logTrainer(params.nicho, 'erro', 'Gemini sem resposta');
        return {
            ok: true,
            nicho: params.nicho,
            atualizado: false,
        };
    }
    // Gemini retornou SEM_ALTERACAO — não atualiza
    if (resposta.trim() === 'SEM_ALTERACAO') {
        logTrainer(params.nicho, 'sem_alteracao');
        return {
            ok: true,
            nicho: params.nicho,
            atualizado: false,
        };
    }
    // Gemini retornou o .md atualizado
    (0, escreverVector_1.escreverNicho)(params.nicho, resposta.trim());
    logTrainer(params.nicho, 'atualizado');
    return { ok: true, nicho: params.nicho, atualizado: true };
}
// ── API pública ──────────────────────────────────────────────
async function treinarNicho(params) {
    const { trainerKey, trainerModel, trainerUrl } = aios_1.TEO;
    if (!trainerKey || !trainerModel || !trainerUrl) {
        return {
            ok: false,
            nicho: params.nicho,
            atualizado: false,
            erro: 'Trainer não configurado',
        };
    }
    try {
        // Lê o conteúdo atual do .md — await obrigatório (lerNicho é async)
        const nichoAtual = await (0, lerVector_1.lerNicho)(params.nicho);
        const conteudoAtual = nichoAtual.conteudo;
        const provider = detectarProvider(trainerUrl);
        if (provider === 'gemini') {
            return await runGemini(params, conteudoAtual);
        }
        // Anthropic ou Ollama — usa tool calling
        const client = new sdk_1.default({
            apiKey: trainerKey,
            ...(provider === 'ollama'
                ? { baseURL: trainerUrl }
                : {}),
        });
        const prompt = await montarPrompt(params, conteudoAtual);
        return await runAnthropicLoop(client, trainerModel, prompt, params.nicho);
    }
    catch (err) {
        const erro = err instanceof Error
            ? err.message
            : 'Erro desconhecido';
        logTrainer(params.nicho, 'erro', erro);
        return {
            ok: false,
            nicho: params.nicho,
            atualizado: false,
            erro,
        };
    }
}
//# sourceMappingURL=agenteTrainer.js.map