# CampusLost: contexto do projeto

Resumo do estado atual para quem chega agora (pessoa ou IA). Gerado em 27/10/2026 a partir do código, do Git e dos documentos do repositório.

Sistema web de achados e perdidos da UNDB. Mini-projeto de Engenharia de Software, processo Cascata.
Equipe: Antonio Alexandre, Mateus Augusto, João Victor e Heitor Cirqueira.
Repositório: https://github.com/alexandre777x/projeto-achados-e-perdidos (ramo `main`).

Documentos de referência:

- `docs/CampusLost_SRS.pdf`: especificação de requisitos (RF01 a RF05, RNF01 a RNF10, UC01 a UC10, RN01 a RN05).
- `docs/mudancas-de-requisitos.md`: mudanças depois do SRS (MR01).
- `docs/diagramas/`: casos de uso e diagramas de sequência (UML).
- `tests/plano-de-testes.md`: casos de teste caixa preta (CT01 a CT19) e caixa branca.
- `README.md`: como rodar e onde fica cada requisito no código.

## 1. Estado atual

### Requisitos funcionais

Todos implementados e cobertos por testes automáticos.

| Requisito | Situação | Onde |
| --- | --- | --- |
| RF01.1 a RF01.5 Cadastro, login, logout, admin só por outro admin | Feito | `AutenticacaoController`, `AutenticacaoService`, `cadastro.html`, `login.html` |
| RF01.6 Recuperar senha por e-mail | Feito (link vale 60 min, uso único; sem SMTP o link sai no terminal) | `RecuperacaoSenhaService`, `EmailService` |
| RF02.1 a RF02.6 Registro de item, 1 a 3 fotos JPG/PNG de até 5 MB, data não futura, status inicial por perfil, confirmar recebimento, editar e excluir | Feito | `ItemController`, `ItemService`, `UploadMiddleware`, `novo-item.html`, `admin.html` |
| RF02.3 Categorias | Feito; o local virou texto livre (MR01) | `ReferenciaController`, `CategoriaRepository` |
| RF03.1 a RF03.5 Busca com filtros, palavra-chave, mensagem de vazio, detalhe sem dados de quem registrou | Feito | `ItemService`, `ItemRepository`, `itens.html`, `item.html` |
| RF04.1 a RF04.7 Reivindicação, perguntas e provas, mensagens, aprovar/rejeitar com motivo, status do item, uma aberta por usuário e item, estado visível | Feito | `ReivindicacaoController`, `ReivindicacaoService`, `item.html`, `reivindicacao.html`, `minhas-reivindicacoes.html` |
| RF05.1 a RF05.3 Devolução (só com reivindicação aprovada; guarda só o tipo do documento) | Feito | `DevolucaoController`, `DevolucaoService` |
| RF05.4 e RF05.5 Relatório por período e CSV | Feito | `RelatorioService`, `RelatorioDevolucoes` |

Funções além do SRS, já feitas: gestão de usuários pelo admin (criar conta, mudar perfil, desativar), página "Meu perfil" (trocar nome e senha), contador de mensagens não lidas, e-mail ao reivindicante na decisão, busca sem acento, paginação de 24 em 24 ("Carregar mais"), itens parados há 30/60/90 dias, barra de progresso do pedido.

### Requisitos não funcionais

| Requisito | Situação |
| --- | --- |
| RNF01 Senha com hash e salt | Feito (`bcryptjs`); testado |
| RNF01.1 Rotas de admin respondem 403 | Feito (`AutenticacaoMiddleware`); testado (CT11) |
| RNF01.2 Sessão expira em 30 min de inatividade | Feito (`Configuracao.minutosSessao = 30`, `rolling: true`) |
| RNF02 Sem rolagem horizontal de 360 a 1920 px | Implementado (todas as páginas têm `viewport` e o CSS tem `@media`); **não conferido em celular de verdade** |
| RNF02.1 Usuário novo busca e reivindica em até 5 min (5 pessoas) | **Não testado** (teste de usabilidade com pessoas) |
| RNF03 Busca em até 2 s com 10.000 itens | Há índice `idx_item_busca`; **não medido** |
| RNF04 Foto de 5 MB em até 10 s a 5 Mbps | **Não medido** |
| RNF05 Backup diário e restauração | **Não implementado.** Só existe a cópia `.bak` feita antes de migrações |
| RNF06 Chrome, Firefox, Edge e Safari | **Não testado** formalmente |
| RNF07 Stack Node + SQLite | Atendido |
| RNF08 Git com commits de todos os integrantes | **Pendente:** os 31 commits do `main` são todos de Alexandre Araujo (29 com esse nome e 2 como "ANTONIO ALEXANDRE DE ARAUJO LIMA") |
| RNF09 LGPD: não mostrar quem registrou o item | Feito; provas de posse em pasta privada (`server/provas/`, não servida) |
| RNF10 Devolução sem número de documento | Feito (só `tipo_documento`) |

### O que não foi testado

- Telas no navegador: a rodada de caixa preta de 23/10/2026 foi feita pela API (`curl`). CT07 (mensagem de busca vazia) e CT18 (CSV aberto no Excel) pedem conferência na tela.
- Envio de e-mail por SMTP real (só o caminho sem SMTP, com o link no terminal, é testado).
- Uso no celular, desempenho (RNF03, RNF04), usabilidade (RNF02.1) e navegadores (RNF06).

## 2. Arquitetura

| Parte | Tecnologia | Pasta |
| --- | --- | --- |
| Front-end | HTML, CSS e JavaScript puros (sem framework) | `client/` |
| Back-end | Node.js, Express 5, TypeScript | `server/src/` |
| Banco | SQLite (`better-sqlite3`, síncrono) | `server/data/campuslost.db` |
| Sessão | `express-session` (memória do processo), cookie `campuslost.sid` | |
| Upload | `multer`: fotos em `server/uploads/` (servidas em `/uploads`, só com login) e provas em `server/provas/` (privadas) | |
| E-mail | `nodemailer` | |

O próprio servidor Express entrega o front-end (`express.static` da pasta `client/`). O site inteiro exige login: sem sessão, as páginas redirecionam para `/login.html?voltar=...` e a API responde 401.

Caminho de uma requisição:

```
App.ts (rota em /api, middlewares exigirLogin / exigirAdmin / upload)
  → controllers/   um método por rota, lê req e monta a resposta
  → services/      regras que envolvem mais de um repositório
  → repositories/  SQL, um por tabela
  → database/Database.ts (singleton da conexão SQLite)
```

`module/` tem as entidades com as regras de negócio (validações, ciclo de vida do item) e é usado por todas as camadas. Erros de regra são `ErroDeNegocio` e viram 400/401/403/404/409 no `ErrorHandlerMiddleware`.

Rotas da API (`server/src/App.ts`):

| Grupo | Rotas |
| --- | --- |
| Autenticação | `POST /auth/cadastro`, `/auth/login`, `/auth/logout`, `/auth/recuperar-senha`, `/auth/redefinir-senha`; `GET /auth/eu` |
| Itens | `GET /itens`, `/itens/:id`; `POST /itens`; admin: `GET /itens/aguardando-recebimento`, `/itens/parados`, `PATCH /itens/:id/recebimento`, `PUT` e `DELETE /itens/:id` |
| Categorias | `GET /referencias/categorias`; admin: `POST /referencias/categorias` |
| Reivindicações | `POST /reivindicacoes`; `GET /reivindicacoes/minhas`, `/nao-lidas`, `/:id`, `/:id/provas/:provaId`, `/:id/mensagens`; `POST /:id/mensagens`; admin: `GET /reivindicacoes`, `PATCH /:id/aprovar`, `/:id/rejeitar` |
| Devoluções (admin) | `POST /devolucoes`; `GET /devolucoes/pendentes`, `/relatorio`, `/relatorio.csv` |
| Usuários | `PATCH /usuarios/eu`, `/usuarios/eu/senha`; admin: `GET /usuarios`, `PATCH /usuarios/:id/perfil`, `/usuarios/:id/ativo` |
| Saúde | `GET /saude` |

Páginas (`client/`): `login`, `cadastro`, `esqueci-senha`, `redefinir-senha`, `index`, `itens`, `item`, `novo-item`, `reivindicacao`, `minhas-reivindicacoes`, `perfil`, `admin`.

## 3. Banco de dados

Definido em `server/database/schema.sql`; `seed.sql` cria só as 6 categorias (Eletrônicos, Documentos, Roupas e acessórios, Material escolar, Chaves, Outros). Não há usuário no seed: o primeiro administrador sai do `npm run criar-admin`.

| Tabela | Conteúdo |
| --- | --- |
| `usuario` | nome, e-mail único, `senha_hash`, perfil (ALUNO, PROFESSOR, ADMINISTRADOR), `ativo` |
| `categoria` | nome único |
| `item` | título, descrição, `data_achado`, status (AGUARDANDO_RECEBIMENTO, DISPONIVEL, EM_REIVINDICACAO, DEVOLVIDO), `local_encontrado` (texto, 3 a 150), categoria, quem registrou |
| `foto` | caminho do arquivo, item |
| `reivindicacao` | status (ABERTA, APROVADA, REJEITADA), respostas de validação, motivo da rejeição, quem decidiu. Índices únicos: uma aberta por usuário e item (RF04.6) e uma aprovada por item (RN02) |
| `prova_posse` | arquivo anexado à reivindicação (pasta privada) |
| `mensagem` | conversa da reivindicação |
| `leitura_conversa` | até qual mensagem cada lado (REIVINDICANTE, ADMINISTRACAO) leu |
| `devolucao` | data e hora, `tipo_documento` (RG, CNH, CARTEIRA_ESTUDANTIL, OUTRO), reivindicação, administrador |
| `historico_status` | toda mudança de status do item, com usuário e data (RN05) |
| `recuperacao_senha` | hash do token, validade, se foi usado |

Mudanças já feitas, com migração automática ao subir o servidor (`Database.ts`):

- **MR01 (23/10/2026), local em texto livre:** `item.local_id` virou `item.local_encontrado` e a tabela `local` saiu. Antes de migrar, o servidor guarda uma cópia `campuslost.db.antes-local-em-texto.bak`.
- **Mensagens não lidas (24/10/2026):** tabela `leitura_conversa`. Nos bancos que já existiam, as mensagens antigas contam como lidas.

Um banco novo é criado sozinho na primeira execução, a partir de `schema.sql` e `seed.sql`.

## 4. Como rodar e testar

Node 20 ou mais novo (`engines` no `package.json`). Última verificação feita com Node v24.11.1. Comandos na pasta `server/`:

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
npm run criar-admin       # primeiro administrador, ou promove uma conta existente
npm run dev               # tsx watch, em http://localhost:3000
npm run build             # tsc, gera server/dist/
npm start                 # node dist/server.js
npm test                  # node:test com tsx; cada arquivo usa um banco temporário
npm run test:cobertura
```

Variáveis do `.env` (ver `server/.env.example`): `PORT`, `SESSION_SECRET`, `DB_PATH`, `UPLOAD_DIR`, `PROVAS_DIR`, `URL_BASE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_REMETENTE`, `EMAIL_DOMINIO`. Sem `SMTP_HOST`, os e-mails aparecem no terminal. Sem `EMAIL_DOMINIO`, qualquer domínio é aceito no cadastro.

Último resultado (27/10/2026, commit `1acbdca`): `npm run build` sem erros e **`npm test` com 285 testes, 285 aprovados, 0 falhas** (57 suítes). Cobertura registrada no plano de testes: 96,4% das linhas, 93,4% dos desvios e 90,6% das funções.

## 5. Decisões e pendências

Decisões tomadas:

- Local do item em texto livre, em vez de uma lista fixa (MR01, motivo registrado em `docs/mudancas-de-requisitos.md`).
- O site inteiro exige login, inclusive a busca e as fotos.
- Administrador só por `npm run criar-admin` ou por outro administrador na tela de Usuários. Ninguém muda o próprio perfil nem desativa a própria conta, e sempre sobra pelo menos um administrador ativo.
- A sessão é conferida com o banco a cada requisição: uma conta desativada perde o acesso na hora.
- O detalhe de uma reivindicação alheia responde 404, não 403, para não revelar que ela existe.
- O CSV leva apóstrofo em células que começam com `=`, `+`, `-` ou `@` (proteção contra fórmula). Efeito colateral registrado: um número negativo também ganharia o apóstrofo.

Pendências:

- **Publicar online.** Em análise: VM grátis da Oracle Cloud (Always Free) com Node, `pm2` e Caddy para HTTPS (domínio pelo sslip.io). O código sobe sem mudanças. O Render grátis foi descartado porque apaga o banco e os uploads a cada reinício. A Vercel foi descartada porque é serverless, sem disco permanente nem sessão em memória.
- **Testar no celular** (RNF02) depois de publicar.
- RNF05 (backup diário): não implementado. Numa VM, pode ser um `cron` que copia `server/data/campuslost.db`.
- RNF08: faltam commits dos outros integrantes.
- Medições e testes manuais: RNF02.1, RNF03, RNF04, RNF06, CT07 e CT18 na tela, e e-mail com SMTP real.
- A sessão fica na memória do processo: um reinício do servidor desloga todo mundo.
- **Fora do Git no momento desta análise:** `docs/diagramas/` (arquivos novos, nunca commitados) e alterações em `docs/CampusLost_SRS.pdf` e `docs/README.md`. O `server/package-lock.json` aparece como modificado, mas a diferença é só de fim de linha (CRLF).

## 6. Trabalho recente

Últimos commits do `main` (todos de 23 e 24/10/2026):

| Commit | O que mudou |
| --- | --- |
| `1acbdca` Página Meu perfil | `perfil.html`; `PATCH /api/usuarios/eu` e `/eu/senha` (a senha nova invalida links de recuperação pendentes); o nome no menu leva ao perfil |
| `8ffd56f` criar-admin promove conta existente | `criar-admin` pergunta o e-mail e oferece promover (e reativar) uma conta existente; Heitor Cirqueira entra no README |
| `3866018` Gestão de usuários e barra de progresso | Seção Usuários na administração, com travas; sessão sincronizada com o banco; barra Enviado → Em análise → Aprovado → Entregue |
| `9db1e96` Busca sem acento, "Carregar mais" e itens parados | Função `sem_acento` no SQLite; paginação de 24 em 24; `GET /api/itens/parados` |
| `004890c` Não lidas e e-mail da decisão | Tabela `leitura_conversa` com migração; `GET /api/reivindicacoes/nao-lidas`; e-mail na aprovação ou rejeição |
| `90b0b14` Novo visual da reivindicação | Linha do tempo, conversa em balões atualizada a cada 20 s, respostas prontas para o admin |
| `afc629d` Novo visual do item | Galeria de fotos, botão "Este item é meu", área de provas com arrastar; corrige botões escondidos que apareciam |
| `6655104` Novo visual da administração | Números de resumo, cartões com foto, relatório em tabelas |
| `49c15ca` Novo visual de minhas reivindicações | Cartões com foto e filtros por situação |
| `9424152` Novo visual de registrar item | Formulário em 3 etapas, chips de categoria, sugestões de local |
| `958f041` Novo visual da busca | Chips, campo "Local / bloco", ordenação; cartão de item compartilhado |
| `ea6418b` Local do item em texto livre (MR01) | Mudança de requisito com migração do banco e testes |
