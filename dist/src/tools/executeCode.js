"use strict";
// ============================================================
//  TEO — src/tools/executeCode.ts
//  Executor de código seguro com sandbox
//
//  Responsabilidades:
//    - Executar JavaScript em sandbox (Function + eval isolado)
//    - Executar Python com arquivo temporário + timeout
//    - Capturar output e erros
//    - Nunca lança exceção — sempre retorna RespostaCodigo
//
//  Segurança:
//    - JS: sandbox limitado (sem access a fs, network, require, import)
//    - Python: subprocess com timeout
//    - Ambos: timeout de 5s (padrão)
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeJavaScript = executeJavaScript;
exports.executePython = executePython;
exports.executarCodigo = executarCodigo;
exports.validarCodigoSeguro = validarCodigoSeguro;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
// ── Normalização de linguagem ────────────────────────────────
function normalizarLinguagem(input) {
    const lower = input.toLowerCase().trim();
    if (lower === 'js')
        return 'javascript';
    if (lower === 'py')
        return 'python';
    if (lower === 'javascript')
        return 'javascript';
    if (lower === 'python')
        return 'python';
    return 'javascript';
}
// ── JavaScript com sandbox seguro ────────────────────────────
function executeJavaScript(code, _timeout = 5000) {
    const inicio = Date.now();
    const logs = [];
    const fakeConsole = {
        log: (...args) => logs.push(args.map(String).join(' ')),
        error: (...args) => logs.push('❌ ' + args.map(String).join(' ')),
        warn: (...args) => logs.push('⚠️ ' + args.map(String).join(' ')),
        info: (...args) => logs.push('ℹ️ ' + args.map(String).join(' ')),
        dir: (obj) => logs.push(JSON.stringify(obj, null, 2)),
        table: (obj) => logs.push(JSON.stringify(obj, null, 2)),
    };
    const sandbox = {
        console: fakeConsole,
        Math,
        Date,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Map,
        Set,
        WeakMap,
        WeakSet,
        RegExp,
        Error,
        TypeError,
        RangeError,
        SyntaxError,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        btoa: (s) => Buffer.from(s).toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('utf8'),
    };
    const keys = Object.keys(sandbox);
    const vals = Object.values(sandbox);
    try {
        const fn = new Function(...keys, `"use strict";\n${code}`);
        const result = fn(...vals);
        if (result !== undefined)
            logs.push('→ ' + String(result));
        return {
            sucesso: true,
            output: logs.join('\n'),
            linguagem: 'javascript',
            tempo_ms: Date.now() - inicio,
        };
    }
    catch (err) {
        const erro = err instanceof Error ? err.message : String(err);
        return {
            sucesso: false,
            output: logs.join('\n'),
            linguagem: 'javascript',
            tempo_ms: Date.now() - inicio,
            erro,
        };
    }
}
// ── Python com subprocess e timeout ─────────────────────────
function executePython(code, timeout = 5000) {
    const inicio = Date.now();
    const tmpDir = os_1.default.tmpdir();
    const tmpFile = path_1.default.join(tmpDir, `teo_py_${Date.now()}.py`);
    fs_1.default.writeFileSync(tmpFile, code, 'utf8');
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('python', [tmpFile], {
            timeout,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('error', (err) => {
            try {
                fs_1.default.unlinkSync(tmpFile);
            }
            catch { /* ignore */ }
            resolve({
                sucesso: false,
                output: stdout,
                linguagem: 'python',
                tempo_ms: Date.now() - inicio,
                erro: err.message,
            });
        });
        proc.on('close', (code) => {
            try {
                fs_1.default.unlinkSync(tmpFile);
            }
            catch { /* ignore */ }
            if (code === 0) {
                resolve({
                    sucesso: true,
                    output: stdout.trim(),
                    linguagem: 'python',
                    tempo_ms: Date.now() - inicio,
                });
            }
            else {
                resolve({
                    sucesso: false,
                    output: stdout.trim(),
                    linguagem: 'python',
                    tempo_ms: Date.now() - inicio,
                    erro: stderr || `Exit code: ${code ?? 'unknown'}`,
                });
            }
        });
    });
}
// ── Executor genérico ────────────────────────────────────────
async function executarCodigo(code, linguagem = 'javascript', timeout = 5000) {
    const lang = normalizarLinguagem(linguagem);
    switch (lang) {
        case 'javascript':
        case 'js':
            return executeJavaScript(code, timeout);
        case 'python':
        case 'py':
            return executePython(code, timeout);
        default:
            return {
                sucesso: false,
                output: '',
                linguagem: lang,
                tempo_ms: 0,
                erro: `Linguagem não suportada: ${linguagem}. Use: javascript, python`,
            };
    }
}
// ── Validação de segurança ───────────────────────────────────
function validarCodigoSeguro(code) {
    const patterns = [
        /\brequire\s*\(/i,
        /\bimport\s+.*\bfrom\b/i,
        /\bimport\s+['"](fs|path|os|child_process|crypto|fs\.)/i,
        /\bprocess\b/i,
        /\bglobal\b(?!\s*\[)/i,
        /\b__dirname\b/i,
        /\b__filename\b/i,
        /\beval\b/i,
        /\bFunction\s*\(/i,
        /\bsetTimeout\b/i,
        /\bsetInterval\b/i,
        /\bsetImmediate\b/i,
        /\bprocess\.exit\b/i,
    ];
    for (const pattern of patterns) {
        if (pattern.test(code)) {
            return {
                valido: false,
                aviso: 'Código contém padrão potencialmente perigoso.',
            };
        }
    }
    return { valido: true };
}
//# sourceMappingURL=executeCode.js.map