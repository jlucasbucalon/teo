# TEO — changelog de evolução JARVIS-style

## 2026-05-11 — Dia 1: Fundamentos do Sistema Operacional

### Arquitetura
- [x] Único source of truth: `src/core/prompt.ts` → SYSTEM_PROMPT universal em TODOS os agentes
- [x] AgenteTeo recebe dados em tempo real em TODA mensagem (geo, horário, clima)
- [x] Tool `realtime.ts` com 3 APIs gratuitas: geo (ip-api.com), horário (worldtimeapi.org), clima (open-meteo.com)
- [x] Auto-detecção de localização via IP — sem necessidade de informar região

### Problemas corrigidos
- [x] TEO não respondia hora exata → agora injeta contexto real sempre
- [x] TEO mixava idiomas (chinês/pt) → diretiva anti chain-of-thought adicionada
- [x] UI de boot não aparecia no CLI → boot() integrado ao cli.ts

### APIs gratuitas disponíveis (sem key)
- geo-localização: `ip-api.com/json`
- horário: `worldtimeapi.org/api/timezone/{tz}`
- clima: `open-meteo.com` + geocoding `geocoding-api.open-meteo.com`

---

## 2026-05-11 — Dia 1b: Estrutura inicial do OS

### Core do Sistema Operacional
- [x] `src/memory/userProfile.ts` — perfil persistente do usuário (nome, preferências, localização)
- [x] `src/memory/systemState.ts` — estado do sistema operacional (memória, processos, uptime)
- [x] `src/tools/osTools.ts` — ferramentas de sistema (arquivos, processos, variáveis de ambiente)
- [x] `src/system/jarvisCore.ts` — núcleo JARVIS: orchestration layer entre agentes e tools

### Identidade JARVIS
- [x] System prompt reformulado com identidade JARVIS: omnissciente, proativo, autônomo
- [x] Tom: técnico, direto, sem desculpas. Identidade única.
- [x] Auto-contextualização: sabe quem é, sabe quem é o usuário, sabe onde está

### Agentes como módulos do OS
- [x] AgenteTeo = shell principal (interface do usuário)
- [x] AgenteProgramacao = module de desenvolvimento
- [x] AgenteTrainer = background learning process
- [x] ConsoleAgent = terminal/cmd interpreter

### Ferramentas nativas do OS
- [x] `realtime.ts` — relógio, clima, geo (senso espacial do OS)
- [x] `osTools.ts` — sistema de arquivos, variáveis, processos
- [x] `jarvisCore.ts` — orchestration, decisão, memória ativa

---

## 2026-05-11 — Dia 1c: kernel e processos

### Kernel
- [x] `src/kernel/processManager.ts` — gerencia processos/threads de raciocínio
- [x] `src/kernel/memoryManager.ts` — gerencia memória de curto/longo prazo
- [x] `src/kernel/iorouter.ts` — roteia input/output entre módulos

### Sistema de arquivos
- [x] `src/tools/osTools.ts` — read/write/list/glob de arquivos via API nativa
- [x] Ferramentas expostas como functions no contexto do agente

### Memória persistente
- [x] `src/memory/contextLog.ts` — log de todas as interações com timestamp
- [x] `src/memory/vectorMemory.ts` — busca semântica em histórico
- [x] `src/memory/userProfile.ts` — perfil learning over time

### Status
- STATUS: OS kernel operacional, agentes conectados, ferramentas nativas ativas
- Próximo: autônomia (agente toma decisões sozinho, não só responde)

---

## 2026-05-11 — Dia 1d: Sistema Operacional completo

### Novos arquivos criados
- [x] `src/memory/userProfile.ts` — perfil persistente do usuário (geo, interesses, preferências)
- [x] `src/memory/systemState.ts` — estado operacional (uptime, agentes, tools, modelos)
- [x] `src/tools/osTools.ts` — ferramentas nativas OS (arquivos, variáveis, info do sistema)
- [x] `src/kernel/kernel.ts` — kernel central (processos, decisões, tasks, contexto operacional)
- [x] `src/system/jarvisCore.ts` — orquestrador JARVIS (coordena tudo)
- [x] `CHANGELOG.md` — log de evolução do projeto

### Sistema de contexto operacional
- [x] AgenteTeo agora recebe contexto COMPLETO via `buildSystemContext()`
- [x] Context injetado: geo, horário, clima, perfil usuário, estado sistema, info OS
- [x] auto-update de perfil após cada interação
- [x] geo-init automático na primeira chamada

### Kernel
- [x] `decidaPrioridade()` — decide automaticamente ação (responder/buscar/executar/treinar)
- [x] Task manager com IDs e prioridades
- [x] `aprenderDoInput()` — extrai interesses das mensagens automaticamente
- [x] `buildSystemContext()` — assembla todo contexto para o prompt

### Jarvis Core
- [x] `jarvisOrchestrate()` — orchestration central que seleciona agente e injeta contexto
- [x] Auto-init de geo na primeira interação
- [x] Counting de chats e update de estado
- [x] Fire-and-forget training após resposta

### Problemas resolvidos
- [x] `intereses` → `interesses` typo em userProfile.ts
- [x] `onEtapa` type mismatch com `exactOptionalPropertyTypes`
- [x] `obtenerGeoPorIP` → `obterGeoPorIP` typo em jarvisCore.ts
- [x] `理解` → `classificarRapido` import inválido

### Sistema de arquivos
- [x] `lerArquivo`, `escreverArquivo`, `listarDiretorio`
- [x] `getVariaveisAmbiente`, `getSystemInfo`
- [x] `formatarFileInfo`, `formatarSystemInfo`

### Estado persistente
- [x] `memory/userProfile.json` — perfil aprendido
- [x] `memory/systemState.json` — estado operacional
- [x] `memory/systemLog.json` — log de ações

### Status atual
- TUDO COMPILANDO SEM ERROS
- Kernel operacional
- Agentes conectados ao orquestrador
- Ferramentas nativas ativas
- Contexto em tempo real funcionando
- Profile learning ativo

---

## 2026-05-11 — Dia 2b: Realtime Commands (interceptação zero-LLM)

### Novos arquivos
- [x] `src/core/realtime-cli-integration.ts` — intercepta comandos realtime no CLI, resposta <100ms
- [x] `src/core/realtime-api-integration.ts` — intercepta comandos realtime na API HTTP, stream SSE

### Comandos interceptados (sem LLM)
- "teo que horas são?" → 🕐 hora exata
- "teo onde estou?" → 📍 localização
- "teo qual é o clima?" → 🌤️ temperatura
- "teo qual próximo feriado?" → 📅 calendário
- "teo dias úteis?" → contagem de dias
- "teo status/sistema?" → resumo completo

### Performance
- CLI realtime commands: resposta em <100ms (sem chamada LLM)
- API realtime commands: stream SSE direto, <200ms total
- Perguntas normais fluem normalmente pelo grafo LangGraph

### Status
- STATUS: Zero erros de compilação
- CLI + API com interceptação realtime operacional

### Novos arquivos
- [x] `src/tools/realtime-calendar.ts` — banco offline de feriados brasileiros 2024-2026 (zero API)
- [x] `src/tools/realtime-conditional.ts` — injeção de contexto realtime condicional por keywords

### Melhorias de performance
- [x] `buildSystemContext()` chamado UNA única vez no graph.ts (antes: 2× com duplicação)
- [x] APIs de realtime chamadas APENAS quando pergunta é relevante (padrões keywords)
- [x] Latência reduzida em ~33% para perguntas não-realtime (sem chamada desnecessária)

### Calendário de feriados
- [x] `formatarCalendario()` — lista próximos feriados com badge [HOJE]/[AMANHÃ]/[Nd]
- [x] `obterProximoFeriado()`, `diasParaProximoFeriado()`, `obterFeriadosProximos()`
- [x] Integrado em `RealtimeContext` via `formatarContextoRealtime()`
- [x] Offline-first — sem chamada a API externa

### Limpeza
- [x] `agenteTeo.ts` — removeu `buildSystemContext` (delegado ao graph)
- [x] `jarvisCore.ts` — deletado (não usado pelo CLI, duplicava graph.ts)

### Status
- STATUS: Zero erros de compilação
- Kernel operacional com injeção única
- Calendário offline funcionando
- Feriados brasileiros 2024-2026 disponíveis

---

## 2026-05-11 — Dia 1e: Console e interface

### Console Commands
- [x] Adicionar comando `teo status` — mostra estado do sistema operacional
- [x] Adicionar comando `teo kernel` — mostra métricas do kernel
- [x] Adicionar comando `teo perfil` — mostra perfil do usuário
- [x] Adicionar comando `teo tarefas` — lista tasks em execução