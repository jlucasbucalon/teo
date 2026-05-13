"use strict";
// ============================================================
//  TEO — src/index.ts
//  Entry point do servidor HTTP
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./api");
const aios_1 = require("../aios");
const ui_js_1 = require("../terminal/ui.js");
const teo_1 = require("../teo");
async function main() {
    await (0, aios_1.boot)();
    await (0, teo_1.inicializarHardware)();
    const app = (0, api_1.createServer)();
    app.listen(aios_1.TEO.porta, () => (0, ui_js_1.printServidor)(aios_1.TEO.porta));
}
main();
//# sourceMappingURL=index.js.map