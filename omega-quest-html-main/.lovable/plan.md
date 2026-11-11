# Plano — Refazer Modo Arcade como Endless Runner

Hoje o Arcade trava o jogador na mesma sala e só faz inimigos spawnarem nas bordas. Vamos transformar em um **endless runner com rolagem lateral infinita**, onde o jogador avança pra direita coletando **estrelas** (pontuação), evitando inimigos e atravessando plataformas geradas proceduralmente — sem fim.

## Como vai funcionar

- O mundo é gerado em **chunks** de ~600 px à medida que o jogador avança. Quando o jogador se aproxima do fim do mundo gerado, novos chunks são empilhados à direita.
- A **câmera segue o jogador** horizontalmente (player fica a ~35% da tela). Verticalmente fixa.
- O jogador **anda livremente para a esquerda e direita**, mas a câmera só avança — voltar muito para a esquerda é bloqueado pela borda esquerda da câmera (não pode voltar pro infinito).
- **Plataformas procedurais**: variam altura, largura, gaps (buracos no chão). Cair no buraco → perde 1 vida (já implementado via pit fall).
- **Estrelas/moedas espalhadas**: 70% normais (+10pts), 25% azuis (+25pts), 5% douradas mega-estrela (+100pts) — visualmente distintas.
- **Inimigos** spawnam à frente do jogador conforme avança: tipo e quantidade escalam com a distância percorrida.
- **Quiz obrigatório a cada 8 inimigos OU a cada 500 metros** (o que vier primeiro). Reset do contador local.
- **Distância** também rende pontos: +1pt a cada 50px andados.
- **Game over** quando vidas chegam a 0 — recorde salvo em `localStorage` (já existe).
- Inimigos / plataformas / partículas que ficam muito atrás da câmera são removidos (garbage collection).

## Telas e HUD

- HUD do Arcade passa a mostrar: **🌟 estrelas coletadas**, **📏 distância em metros**, **kills até próximo quiz**.
- Fundo: reaproveita o tema "pombal" (céu noturno estrelado) com parallax — duas camadas de estrelas com velocidades diferentes pra dar sensação de profundidade infinita.

## Arquivos e mudanças técnicas

Tudo em `src/pages/Index.tsx`. Sem mudança em `questions.ts`.

### Novo state no `stateRef`
```
arcadeWorldX: 0              // distância acumulada do jogador (px)
arcadeCameraX: 0             // posição da câmera (px)
arcadeChunksUntilX: 0        // até onde o mundo está gerado
arcadeStars: 0               // estrelas coletadas
arcadeMeters: 0              // distância em metros
arcadeKillsToQuiz: 8         // contador regressivo
arcadeLastQuizMeters: 0
```

### Coin ganha tipo
```ts
interface Coin { x: number; y: number; taken: boolean; phase: number; kind?: "normal" | "blue" | "gold" }
```
`drawCoins` desenha cores diferentes por `kind`. Pontuação = 10/25/100.

### Geração procedural
- `generateArcadeChunk(fromX: number)` adiciona ao `s.level.platforms`, `s.level.coins`, `s.level.enemies` itens posicionados entre `fromX` e `fromX + 600`.
- Padrões aleatórios: plataforma única longa, escadinha, ilhas com gap, plataforma alta com várias estrelas, "rio de estrelas" em arco.
- 30% de chance de incluir 1–2 inimigos no chunk (tipo escalonado pela distância).
- Chão base: segmentos com **gaps ocasionais** (10% chance de buraco de 80–120px).

### Loop principal (`update`)
- Em arcade:
  - Atualiza `arcadeWorldX = player.x`, `arcadeMeters = Math.floor(player.x / 60)`.
  - `arcadeCameraX = Math.max(arcadeCameraX, player.x - W * 0.35)`.
  - Enquanto `arcadeChunksUntilX < arcadeCameraX + W * 2`, chama `generateArcadeChunk`.
  - Limpa do `level` tudo com `x + w < arcadeCameraX - 200`.
  - Bloqueio à esquerda: `if (player.x < arcadeCameraX) player.x = arcadeCameraX`.
  - Substitui o bloco atual de "spawn em ondas" (linhas ~649–659).
  - Score por distância: a cada 50px novos, +1pt.
  - Quiz check: `if (arcadeKillsToQuiz <= 0 || arcadeMeters - arcadeLastQuizMeters >= 500) arcadeForceQuiz()`.

### Renderização
- No `render`, se modo arcade, aplicar `ctx.translate(-cameraX, 0)` antes de desenhar platforms/coins/enemies/drops/player/projectiles.
- Background (céu, parallax estrelas) **não translada** — fica fixo, com offset baseado em `cameraX * 0.2` para parallax.
- Vinheta/fog continuam em coordenadas de tela.

### `beginArcade`
- Limpa tudo, gera os **3 primeiros chunks**, posiciona o jogador em `x = 60` num chão garantido (primeira plataforma sem gap).

### HUD condicional
- Quando `mode === "arcade"`, troca a linha "ARCADE · KILLS X · BEST Y" por:
  `🌟 ${arcadeStars} · 📏 ${arcadeMeters}m · ⚔ ${arcadeKillsToQuiz} p/ quiz · BEST ${arcadeBest}`

## Fora de escopo

- Não muda o modo História.
- Não muda arte/sprites dos inimigos.
- Não adiciona novos tipos de inimigo nem chefes para o arcade.
- Sem ranking online.

## Bug corrigido junto

O erro `Cannot read properties of undefined (reading 'sky')` ocorre porque em alguns paths `s.room` pode ficar fora dos limites de `ROOMS`. Vou clampar `ROOMS[Math.min(s.room, ROOMS.length - 1)]` no render e no HUD para evitar crash quando alternamos modos.
