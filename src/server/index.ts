// ============================================================
//  TEO — src/index.ts
//  Entry point do servidor HTTP
// ============================================================

import { createServer } from './api'
import { boot, TEO } from '../aios'
import { printServidor } from '../terminal/ui.js'
import { inicializarHardware } from '../teo'

async function main() {
  await boot()
  await inicializarHardware()
  const app = createServer()
  app.listen(TEO.porta, () => printServidor(TEO.porta))
}

main()
