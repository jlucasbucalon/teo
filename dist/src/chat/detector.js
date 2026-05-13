"use strict";
// ============================================================
//  TEO — src/chat/detector.ts
//  Detecta comandos vs mensagens.
//  Fuzzy match em verbos e nomes. Auxilia em erros.
//  Intercepta ANTES de chamar o agente.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectarComando = detectarComando;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const modules_1 = require("./modules");
// ── Verbos canonical e sinônimos ────────────────────────────
const VERBOS = {
    criar: [
        'criar',
        'novo',
        'adicionar',
        'new',
        'add',
        'criarr',
    ],
    abrir: [
        'abrir',
        'entrar',
        'open',
        'acessa',
        'load',
        'abe',
        'abri',
    ],
    fechar: ['fechar', 'sair', 'close', 'encerra', 'fechart'],
    listar: [
        'listar',
        'ver',
        'mostrar',
        'list',
        'ls',
        'mostra',
        'lista',
    ],
    excluir: [
        'excluir',
        'deletar',
        'remover',
        'apagar',
        'delete',
        'exclur',
        'deleta',
    ],
    renomear: [
        'renomear',
        'mudar',
        'rename',
        'mv',
        'renomeia',
    ],
    exportar: [
        'exportar',
        'export',
        'salvar',
        'baixa',
        'exorta',
    ],
};
const VERBO_CANONICO = {};
for (const [canonico, sinonimos] of Object.entries(VERBOS)) {
    for (const s of sinonimos)
        VERBO_CANONICO[s] = canonico;
}
// ── Comandos especiais (exatos) ─────────────────────────────
const ESPECIAIS = {
    ajuda: () => (0, modules_1.helpTexto)(),
    help: () => (0, modules_1.helpTexto)(),
    '?': () => (0, modules_1.helpTexto)(),
    comandos: () => (0, modules_1.helpTexto)(),
    historico: () => 'Use "teo status" para info do sistema ou "teo listar chats" para ver chats.',
    history: () => 'Use "teo status" para info do sistema ou "teo listar chats" para ver chats.',
    log: () => 'Use "teo status" para info do sistema ou "teo listar chats" para ver chats.',
    status: () => `TEO operacional  |  modo: ${modules_1.estado.chatAtual ? 'ativo' : 'standby'}  |  chat: ${modules_1.estado.chatAtual ?? 'nenhum'}`,
    info: () => `TEO operacional  |  modo: ${modules_1.estado.chatAtual ? 'ativo' : 'standby'}  |  chat: ${modules_1.estado.chatAtual ?? 'nenhum'}`,
    estado: () => `TEO operacional  |  modo: ${modules_1.estado.chatAtual ? 'ativo' : 'standby'}  |  chat: ${modules_1.estado.chatAtual ?? 'nenhum'}`,
    cancelar: () => {
        modules_1.estado.esperandoNomeChat = false;
        modules_1.estado.esperandoNomeExclusao = false;
        modules_1.estado.esperandoNomeAbertura = false;
        modules_1.estado.esperandoNomeRenomear = false;
        modules_1.estado.esperandoNomeExportar = false;
        modules_1.estado.fuzzyPendente = null;
        return 'Operação cancelada.';
    },
    cancel: () => {
        modules_1.estado.esperandoNomeChat = false;
        modules_1.estado.esperandoNomeExclusao = false;
        modules_1.estado.esperandoNomeAbertura = false;
        modules_1.estado.esperandoNomeRenomear = false;
        modules_1.estado.esperandoNomeExportar = false;
        modules_1.estado.fuzzyPendente = null;
        return 'Operação cancelada.';
    },
    para: () => 'Use "teo ajuda" para ver os comandos disponíveis.',
    stop: () => 'Use "teo ajuda" para ver os comandos disponíveis.',
    sair: () => '__sair__',
    exit: () => '__sair__',
    quit: () => '__sair__',
    encerrar: () => '__sair__',
    desligar: () => '__sair__',
};
// ── Levenshtein ──────────────────────────────────────────────
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 +
                        Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}
function melhorFuzzy(palavra, lista) {
    // ── CORREÇÃO: palavras com menos de 3 chars nunca fazem fuzzy match
    // "oi", "eu", "ok", "ls" etc. causavam falsos positivos
    if (palavra.length < 3)
        return null;
    let melhor = null;
    let menorDist = Infinity;
    for (const opcao of lista) {
        // Só compara com palavras de tamanho similar (diferença máxima de 50%)
        // Evita "oi" → "criar" por exemplo
        if (Math.abs(opcao.length - palavra.length) >
            Math.ceil(palavra.length * 0.5))
            continue;
        const dist = levenshtein(palavra.toLowerCase(), opcao.toLowerCase());
        if (dist < menorDist) {
            menorDist = dist;
            melhor = opcao;
        }
    }
    // Limiar mais conservador — mínimo 1, máximo 30% do tamanho da palavra
    const limiar = Math.max(1, Math.floor(palavra.length * 0.3));
    return menorDist <= limiar ? melhor : null;
}
// ── Sugerir chat (fuzzy name) ───────────────────────────────
const CHAT_DIR = path.resolve(__dirname, '../../src/memory/chatCache');
function sugerirChat(nomeDigitado) {
    if (!fs.existsSync(CHAT_DIR))
        return null;
    const arquivos = fs
        .readdirSync(CHAT_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    if (!arquivos.length)
        return null;
    let melhor = null;
    let menorDist = Infinity;
    for (const nome of arquivos) {
        const dist = levenshtein(nomeDigitado.toLowerCase(), nome.toLowerCase());
        if (dist < menorDist) {
            menorDist = dist;
            melhor = nome;
        }
    }
    return menorDist <= 3 ? melhor : null;
}
// ── Validar se parece mensagem (não comando) ────────────────
const PALAVRAS_NAO_COMANDO = [
    'como',
    'o que',
    'qual',
    'por que',
    'quando',
    'onde',
    'quem',
    'me ajude',
    'preciso',
    'quero',
    'gostaria',
    'pode',
    'poderia',
    'explica',
    'conta',
    'fala',
    'diz',
    'manda',
    'mostra',
    'ensina',
    'tenho',
    'faz',
    'fazer',
    'ser',
    'está',
    'estou',
    'sou',
    'somos',
    'tu',
    'você',
    'eu',
    'nos',
    'vocês',
    'ele',
    'ela',
    'fazendo',
    'pensando',
    'trabalhando',
    'tentando',
    'usando',
    'porém',
    'mas',
    'então',
    'porque',
    'assim',
    'script',
    'código',
    'problema',
    'erro',
    'bug',
    'falha',
    'teste',
    'projeto',
    'arquivo',
    'função',
    'variável',
    'classe',
];
function pareceMensagem(texto) {
    const t = texto.toLowerCase().trim();
    const palavras = t.split(/\s+/);
    // Palavra única curta (saudações, respostas) → nunca é comando
    if (palavras.length === 1 && palavras[0].length <= 4) {
        return true;
    }
    // Frases longas com palavras típicas de mensagem
    if (palavras.length > 8) {
        const temPalavraNaoComando = PALAVRAS_NAO_COMANDO.some((p) => t.includes(p));
        if (temPalavraNaoComando)
            return true;
    }
    // Começa com pergunta
    if (/^(como|o que|qual|por que|quando|onde|quem|me ajude|pode)\s/i.test(t)) {
        return true;
    }
    // Contém verbos no gerúndio ou passado recente
    if (/\w+(ando|endo|indo|ido|ê|eu)\s/.test(t))
        return true;
    // Contém artigo definido em frases longas
    if (palavras.length > 5 &&
        /os?\s+\w+\s+\w+\s+\w+\s+\w/i.test(t)) {
        return true;
    }
    return false;
}
function pareceComandoParcial(texto) {
    const t = texto.toLowerCase().trim();
    if (t.startsWith('teo '))
        return true;
    const palavras = t.split(/\s+/);
    if (palavras.length <= 4) {
        const primeiro = palavras[0] ?? '';
        if (primeiro && VERBO_CANONICO[primeiro])
            return true;
        const conhecidos = [
            'criar',
            'abrir',
            'fechar',
            'listar',
            'excluir',
            'renomear',
            'exportar',
            'novo',
            'deletar',
            'apagar',
        ];
        return conhecidos.some((v) => primeiro.includes(v));
    }
    return false;
}
// ── Detector principal ───────────────────────────────────────
function detectarComando(input) {
    const textoOriginal = input.trim();
    const t = textoOriginal.toLowerCase();
    // ── 0. Classificar intent: mensagem vs comando ────────────
    const ehMensagem = pareceMensagem(textoOriginal);
    const ehComandoParcial = pareceComandoParcial(textoOriginal);
    // Se parece mensagem E não começa com "teo" → não é comando
    if (ehMensagem && !t.startsWith('teo')) {
        if (!ehComandoParcial) {
            return {
                ehComando: false,
                resultado: null,
            };
        }
    }
    // ── 1. Prefixo "teo" explícito ────────────────────────────
    if (t.startsWith('teo ')) {
        const corpo = t.slice(4).trim();
        const partes = corpo.split(/\s+/);
        const primeiro = partes[0] ?? '';
        // 1a. Comandos especiais (ajuda, status, sair, etc.)
        const especial = ESPECIAIS[primeiro];
        if (especial) {
            const resultado = especial();
            return { ehComando: true, resultado };
        }
        // 1b. "teo modo X" → tratamento especial (CLI)
        if (primeiro === 'modo') {
            return {
                ehComando: true,
                resultado: null,
                ajuda: '__modo__',
            };
        }
        // 1c. Fuzzy match no verbo
        const verboCorrigido = melhorFuzzy(primeiro, Object.values(VERBOS).flat());
        if (!verboCorrigido) {
            const todosVerbos = Object.values(VERBOS).flat();
            const similar = melhorFuzzy(primeiro, todosVerbos);
            if (similar && VERBO_CANONICO[similar]) {
                return {
                    ehComando: true,
                    resultado: `Comando não reconhecido. O Senhor quis dizer "${similar}"? Use "teo ajuda" para ver os comandos.`,
                    verboCorrigido: VERBO_CANONICO[similar],
                    ajuda: similar,
                };
            }
            return { ehComando: false, resultado: null };
        }
        const verboCanonico = VERBO_CANONICO[verboCorrigido];
        const args = partes.slice(1).join(' ');
        return processarVerbo(verboCanonico, args);
    }
    // ── 2. Sem prefixo "teo" — pode ser comando direto ─────────
    // Verifica se é comando especial sem "teo"
    const especial = ESPECIAIS[t];
    if (especial) {
        return { ehComando: true, resultado: especial() };
    }
    // Verbo direto
    const partes = t.split(/\s+/);
    const primeiro = partes[0] ?? '';
    // Fuzzy match no verbo
    const verboCorrigido = melhorFuzzy(primeiro, Object.values(VERBOS).flat());
    if (!verboCorrigido) {
        if (ehComandoParcial) {
            const todosVerbos = Object.values(VERBOS).flat();
            const similar = melhorFuzzy(primeiro, todosVerbos);
            if (similar && VERBO_CANONICO[similar]) {
                return {
                    ehComando: true,
                    resultado: `O Senhor quis dizer "teo ${similar}"? Use "teo ajuda" para ver os comandos.`,
                    verboCorrigido: VERBO_CANONICO[similar],
                    ajuda: `teo ${similar}`,
                };
            }
        }
        return { ehComando: false, resultado: null };
    }
    const verboCanonico = VERBO_CANONICO[verboCorrigido];
    const args = partes.slice(1).join(' ');
    return processarVerbo(verboCanonico, args);
}
// ── Processar verbo canônico ────────────────────────────────
function processarVerbo(verbo, args, _verboOriginal) {
    const chatDir = CHAT_DIR;
    switch (verbo) {
        case 'criar': {
            const nomeChat = args.replace(/^(chat|novo)\s*/gi, '').trim() || '';
            if (nomeChat) {
                return {
                    ehComando: true,
                    resultado: `Chat "${nomeChat}" criado e aberto, Senhor.`,
                    verboCorrigido: verbo,
                };
            }
            return {
                ehComando: true,
                resultado: 'Qual o nome do chat?',
                verboCorrigido: verbo,
            };
        }
        case 'abrir': {
            const nomeChat = args
                .replace(/^(chat)?\s*/gi, '')
                .trim();
            if (!nomeChat)
                return {
                    ehComando: true,
                    resultado: 'Qual chat deseja abrir?',
                    verboCorrigido: verbo,
                };
            const existe = fs.existsSync(path.join(chatDir, `${nomeChat}.json`));
            if (existe) {
                return {
                    ehComando: true,
                    resultado: `Chat "${nomeChat}" aberto.`,
                    verboCorrigido: verbo,
                };
            }
            const sug = sugerirChat(nomeChat);
            if (sug) {
                return {
                    ehComando: true,
                    resultado: `Chat "${nomeChat}" não encontrado. O Senhor quis dizer "${sug}"? (sim / não)`,
                    verboCorrigido: verbo,
                    chatSugerido: sug,
                };
            }
            return {
                ehComando: true,
                resultado: `Chat "${nomeChat}" não encontrado. Use "teo listar chats" para ver disponíveis.`,
                verboCorrigido: verbo,
            };
        }
        case 'fechar':
            return {
                ehComando: true,
                resultado: modules_1.estado.chatAtual
                    ? `Chat "${modules_1.estado.chatAtual}" fechado.`
                    : 'Nenhum chat aberto.',
                verboCorrigido: verbo,
            };
        case 'listar': {
            if (!fs.existsSync(chatDir)) {
                return {
                    ehComando: true,
                    resultado: 'Nenhum chat encontrado.',
                    verboCorrigido: verbo,
                };
            }
            const arquivos = fs
                .readdirSync(chatDir)
                .filter((f) => f.endsWith('.json'));
            if (!arquivos.length) {
                return {
                    ehComando: true,
                    resultado: 'Nenhum chat encontrado.',
                    verboCorrigido: verbo,
                };
            }
            const lista = arquivos
                .map((f) => {
                const nome = f.replace('.json', '');
                return `  - ${nome}${nome === modules_1.estado.chatAtual ? ' ◀ ativo' : ''}`;
            })
                .join('\n');
            return {
                ehComando: true,
                resultado: `Chats:\n${lista}`,
                verboCorrigido: verbo,
            };
        }
        case 'excluir': {
            const nomesRaw = args.replace(/^chat\s*/gi, '').trim();
            if (!nomesRaw)
                return {
                    ehComando: true,
                    resultado: 'Qual chat deseja excluir?',
                    verboCorrigido: verbo,
                };
            const nomes = nomesRaw
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean);
            const excluidos = [];
            const naoEncontrados = [];
            for (const nome of nomes) {
                const existe = fs.existsSync(path.join(chatDir, `${nome}.json`));
                if (existe) {
                    fs.unlinkSync(path.join(chatDir, `${nome}.json`));
                    if (modules_1.estado.chatAtual === nome)
                        modules_1.estado.chatAtual = null;
                    excluidos.push(nome);
                }
                else {
                    const sug = sugerirChat(nome);
                    if (sug) {
                        return {
                            ehComando: true,
                            resultado: `Chat "${nome}" não encontrado. O Senhor quis dizer "${sug}"? (sim / não)`,
                            verboCorrigido: verbo,
                            chatSugerido: sug,
                        };
                    }
                    naoEncontrados.push(nome);
                }
            }
            const partes = [];
            if (excluidos.length === 1)
                partes.push(`Chat "${excluidos[0]}" excluído.`);
            else if (excluidos.length > 1)
                partes.push(`Chats excluídos: ${excluidos.map((n) => `"${n}"`).join(', ')}.`);
            if (naoEncontrados.length)
                partes.push(`Não encontrados: ${naoEncontrados.map((n) => `"${n}"`).join(', ')}.`);
            return {
                ehComando: true,
                resultado: partes.join('\n'),
                verboCorrigido: verbo,
            };
        }
        case 'renomear': {
            const match = args.match(/^(.+?)\s+para\s+(.+)$/i);
            if (!match || !match[1] || !match[2]) {
                return {
                    ehComando: true,
                    resultado: 'Use: teo renomear chat <nome antigo> para <nome novo>',
                    verboCorrigido: verbo,
                };
            }
            const oldName = match[1].trim();
            const newName = match[2].trim();
            const oldPath = path.join(chatDir, `${oldName}.json`);
            const newPath = path.join(chatDir, `${newName}.json`);
            if (!fs.existsSync(oldPath)) {
                const sug = sugerirChat(oldName);
                if (sug) {
                    return {
                        ehComando: true,
                        resultado: `Chat "${oldName}" não encontrado. O Senhor quis dizer "${sug}"? (sim / não)`,
                        verboCorrigido: verbo,
                        chatSugerido: sug,
                    };
                }
                return {
                    ehComando: true,
                    resultado: `Chat "${oldName}" não encontrado.`,
                    verboCorrigido: verbo,
                };
            }
            if (fs.existsSync(newPath)) {
                return {
                    ehComando: true,
                    resultado: `Já existe um chat com o nome "${newName}".`,
                    verboCorrigido: verbo,
                };
            }
            const data = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
            data.id = newName;
            fs.writeFileSync(newPath, JSON.stringify(data, null, 2));
            fs.unlinkSync(oldPath);
            if (modules_1.estado.chatAtual === oldName)
                modules_1.estado.chatAtual = newName;
            return {
                ehComando: true,
                resultado: `Chat renomeado de "${oldName}" para "${newName}".`,
                verboCorrigido: verbo,
            };
        }
        case 'exportar': {
            const nomeChat = args
                .replace(/^(chat)?\s*/gi, '')
                .trim();
            if (!nomeChat)
                return {
                    ehComando: true,
                    resultado: 'Qual chat deseja exportar?',
                    verboCorrigido: verbo,
                };
            const file = path.join(chatDir, `${nomeChat}.json`);
            if (!fs.existsSync(file)) {
                const sug = sugerirChat(nomeChat);
                if (sug) {
                    return {
                        ehComando: true,
                        resultado: `Chat "${nomeChat}" não encontrado. O Senhor quis dizer "${sug}"? (sim / não)`,
                        verboCorrigido: verbo,
                        chatSugerido: sug,
                    };
                }
                return {
                    ehComando: true,
                    resultado: `Chat "${nomeChat}" não encontrado.`,
                    verboCorrigido: verbo,
                };
            }
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            const msgs = Array.isArray(data.mensagens)
                ? data.mensagens
                : [];
            const criado = data.createdAt
                ? new Date(data.createdAt).toLocaleString('pt-BR')
                : '—';
            const linhas = [
                `Chat: ${nomeChat}`,
                `Criado em: ${criado}`,
                `Total de mensagens: ${msgs.length}`,
                '─'.repeat(40),
                '',
            ];
            for (const m of msgs)
                linhas.push(`[${m.role === 'user' ? 'Senhor' : 'TEO'}]: ${m.content}`, '');
            const destino = path.join(chatDir, `${nomeChat}.txt`);
            fs.writeFileSync(destino, linhas.join('\n'), 'utf8');
            return {
                ehComando: true,
                resultado: `Chat exportado para ${destino}.`,
                verboCorrigido: verbo,
            };
        }
        default:
            return { ehComando: false, resultado: null };
    }
}
//# sourceMappingURL=detector.js.map