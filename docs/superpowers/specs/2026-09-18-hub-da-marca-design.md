# Hub da Marca + Gerador de Esqueleto de Calendário — Design Spec
**Data:** 2026-09-18
**Status:** Aguardando revisão do usuário

---

## Visão Geral

Hoje, quando alguém vai criar conteúdo pra um cliente, a única "memória" da marca fica espalhada em notas soltas e na cabeça de quem já trabalha com aquele cliente há tempo. Isso faz o conteúdo (e qualquer geração assistida por IA) sair genérico.

Este projeto cria, por cliente, um **Hub da Marca**: uma página central e rica onde fica tudo que descreve quem aquele cliente é — missão, público, tom de voz, identidade visual, operação e estratégia de conteúdo. Em cima dessa base, um **Gerador de Esqueleto de Calendário Editorial** usa esses dados (+ o histórico recente de posts) pra propor, com um clique, N ideias de pauta pro mês, já divididas por formato (Reels / Estático / Carrossel) e plantadas como rascunhos no calendário — prontas pra equipe escrever a legenda de verdade e anexar mídia em cima.

Este documento cobre as duas partes juntas porque a segunda depende diretamente da primeira (o gerador só funciona bem se o Hub estiver bem preenchido).

**Fora de escopo deste projeto** (fase futura, avaliar depois): integração automática com a API do Instagram. Motivo: exige app da Meta aprovado, verificação de negócio e autorização individual de cada cliente — não é uma tarefa de engenharia isolada, depende de aprovação externa. Nesta fase, o Hub tem um campo de observações de Instagram preenchido manualmente pela equipe.

---

## 1. Modelo de dados

A tabela `client_extras` já existe (usada hoje pela aba "Dados": `responsavel`, `objectives`, `social_media` jsonb, `links` jsonb, `passwords` jsonb). Ela ganha colunas novas — nada do que já existe é removido ou renomeado, só cresce:

| Coluna nova | Tipo | Seção no Hub |
|---|---|---|
| `mission` | text | Sobre a marca |
| `positioning` | text | Sobre a marca (posicionamento vs. concorrência) |
| `target_audience` | text | Público-alvo |
| `competitors` | text | Concorrência (lista livre, 2-3 nomes) |
| `tone_of_voice` | text | Voz & Estilo |
| `avoid_topics` | text | Voz & Estilo (o que nunca falar/mostrar) |
| `brand_colors` | text | Identidade visual (paleta, texto livre tipo "#111111, dourado") |
| `brand_manual_url` | text | Identidade visual (link do PDF, via upload) |
| `logo_url` | text | Identidade visual (link da imagem, via upload) |
| `products_services` | text | Produto/Serviço |
| `recurring_promos` | text | Operação |
| `responsible_contacts` | jsonb | Operação (lista de `{name, role, contact}`, mesmo padrão de `social_media`) |
| `content_pillars` | text | Estratégia de conteúdo (pilares + proporção ideal) |
| `content_goal` | text | Estratégia de conteúdo (objetivo do momento) |
| `instagram_notes` | text | Observações de Instagram |

Todas as colunas são opcionais (nullable) — a equipe preenche o que souber, sem bloqueio. A rota `/api/clients/[id]/extras` (GET/PUT) é a mesma de hoje, só o payload cresce pra incluir os campos novos.

Upload de manual de marca e logo reaproveita o mesmo mecanismo de Storage já usado na aba "Documentos"/"Editorial" (bucket existente, sem infraestrutura nova).

---

## 2. Página do Hub — `/clientes/[id]/hub`

Página nova e dedicada (não mais uma aba entre as 9 que já existem em `/clientes/[id]`). Estrutura, de cima pra baixo:

1. **Cabeçalho** — nome do cliente, link de volta pra ficha completa
2. **Gerador de calendário** (seção 3 deste documento) — fica logo no topo, é a ação mais usada
3. **Sobre a marca** — missão, posicionamento
4. **Público-alvo & Concorrência**
5. **Voz & Estilo** — tom de voz, o que evitar, pilares de conteúdo + objetivo do momento
6. **Identidade visual** — paleta, upload de manual de marca e logo
7. **Produto/Serviço** — portfólio principal
8. **Operação** — promoções recorrentes, responsáveis no local
9. **Redes sociais, Links e Senhas** — migrado da aba "Dados" (ver seção 4)
10. **Observações de Instagram** — texto livre

Cada campo salva sozinho ao perder o foco (`onBlur`), igual já funciona na aba "Dados" hoje — sem botão de "salvar" separado.

**Acesso:** dois botões levam até aqui — um no topo da ficha do cliente (`/clientes/[id]`), outro na Central de Conteúdo, visível quando uma empresa específica está selecionada (não aparece em "Todos").

---

## 3. Gerador de Esqueleto de Calendário

Formulário no topo do Hub:
- **Mês** (padrão: mês seguinte)
- **Quantidade por formato**: Reels, Estático, Carrossel (três campos numéricos; o total é a soma) — mapeando pro `content_type` que já existe hoje na Central de Conteúdo: Reels → `reels`, Estático → `feed`, Carrossel → `carrossel`. Nenhum valor novo de `content_type` é criado.
- **Foco do mês** (texto livre — ex: promoção, lançamento, campanha sazonal)
- **O que evitar** (texto livre — ex: "já fizemos muito conteúdo de bastidores mês passado")

Botão "Gerar" chama uma rota nova, `POST /api/clients/[id]/generate-calendar`, que:

1. Carrega todos os campos do Hub daquele cliente (`client_extras`)
2. Carrega os títulos dos posts dos últimos ~60 dias daquele cliente (pra IA não repetir tema, além do que foi pedido manualmente em "o que evitar")
3. Monta um prompt com: identidade da marca inteira + histórico recente + foco/restrições do mês + quantidade exata pedida por formato
4. Chama o mesmo motor de IA que o Omar já usa (Groq, modelo `openai/gpt-oss-120b` — sem custo adicional, sem chave nova), pedindo a resposta em JSON estrito: lista de `{ title, content_type, ideia }`
5. Cria N registros em `content_posts` com `status: 'rascunho'`, `content_type` já preenchido, `title` e a ideia/racional guardada em `notes` (pra quem for escrever a legenda de verdade saber o raciocínio por trás) — datas espalhadas uniformemente ao longo do mês escolhido, totalmente reagendáveis depois pela equipe, do jeito que qualquer post já é hoje
6. Some caso de erro (ex: limite grátis da Groq excedido) reaproveita a mesma mensagem amigável que o Omar já usa hoje

O resultado aparece na Central de Conteúdo como qualquer rascunho — a equipe abre cada um, escreve a legenda final e anexa a mídia, sem mudar o fluxo de trabalho de hoje.

---

## 4. Migração da aba "Dados"

A aba "Dados" (dentro de `/clientes/[id]`) é removida da barra de abas. Seu conteúdo (Objetivos, Redes Sociais, Links, Senhas) passa a viver dentro do Hub — mesma tabela, mesmos campos, só muda onde aparece na tela. Nenhum dado é perdido ou movido de tabela; é puramente uma mudança de onde o formulário é renderizado.

---

## 5. Segurança e acesso

Mesma regra de acesso que já vale pra ficha do cliente hoje — quem já pode ver/editar `client_extras` (inclusive senhas) continua podendo; não muda nada de permissão. A rota de geração (`generate-calendar`) segue o mesmo padrão de autenticação das demais rotas internas (bloqueada pelo proxy pra quem não está logado).

---

## Fora de escopo (fica pra decidir depois, não faz parte desta entrega)

- Integração com a API oficial do Instagram (leitura automática de posts/métricas)
- Agendamento automático de publicação (o "rascunho" continua exigindo que a equipe finalize e publique manualmente, como hoje)
- Edição em lote dos posts gerados (a equipe edita um por um, na tela que já existe)
