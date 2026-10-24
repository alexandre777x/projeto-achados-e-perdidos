# Plano de testes do CampusLost

Fase 4 do Cascata. Os casos abaixo são o começo da **caixa preta** (testa o que o sistema faz, sem olhar o código). Cada caso vem de um requisito do SRS. Preencha as duas últimas colunas ao executar.

## Execução de 23/10/2026

Os 18 casos foram executados **pela API** (requisições HTTP direto ao servidor, com `curl`), num banco de teste separado, com o código do `main` no commit `6eea046`. As telas não foram conferidas no navegador nesta rodada: onde o resultado depende da tela, a coluna "Situação" avisa.

| ID | Requisito | Entrada | Resultado esperado | Resultado obtido | Situação |
| --- | --- | --- | --- | --- | --- |
| CT01 | RF01.2 | Cadastro com e-mail já existente | Sistema recusa e informa que o e-mail já está em uso | 409 "Já existe uma conta com este e-mail." (também com maiúsculas diferentes) | Aprovado |
| CT02 | RF01.3 | Login com senha correta | Sessão iniciada | 200 com os dados do usuário; `/api/auth/eu` reconhece a sessão | Aprovado |
| CT03 | RF01.3 | Login com senha errada | Acesso negado, sem iniciar sessão | 401 "E-mail ou senha inválidos."; `/api/auth/eu` responde 401 | Aprovado |
| CT04 | RF02.2 | Registro de item com 4 fotos | Sistema recusa (máximo de 3 fotos) | 400 "Envie no máximo 3 arquivos."; nenhum arquivo fica em `uploads/` | Aprovado |
| CT05 | RF02.4 | Registro com data do achado no futuro | Sistema recusa | 400 "A data do achado não pode ser futura." | Aprovado |
| CT06 | RF03.2 | Busca com categoria e uma palavra do local ao mesmo tempo (revisado pela MR01: o local virou texto livre) | Lista só os itens que atendem aos dois critérios | Só o item da categoria escolhida cujo local tem a palavra (teste automático em `ItemService.test.ts`) | Aprovado |
| CT07 | RF03.4 | Busca sem nenhum resultado | Mensagem clara de que nada foi encontrado | API devolve lista vazia; a mensagem é montada por `itens.html` | Aprovado na API; conferir a tela |
| CT08 | RF04.6 | Mesmo usuário reivindica o mesmo item duas vezes | Segunda tentativa é recusada | 409 "Você já tem uma reivindicação aberta para este item." | Aprovado |
| CT09 | RF04.4 | Administrador rejeita reivindicação sem informar o motivo | Sistema exige o motivo | 400 "Informe o motivo da rejeição (até 500 caracteres)." | Aprovado |
| CT10 | RF05.1 | Devolução de item sem reivindicação aprovada | Sistema recusa | 409 "Só é possível devolver um item com reivindicação aprovada." | Aprovado |
| CT11 | RNF01.1 | Aluno chama uma rota de administração | Resposta 403 | 403 "Acesso restrito à administração." | Aprovado |
| CT12 | RF01.6 | Pedido de recuperação com e-mail não cadastrado | Mesma mensagem do e-mail cadastrado, sem envio de link | Mesma resposta 200 nos dois casos; só o e-mail cadastrado gerou link | Aprovado |
| CT13 | RF01.6 | Link de recuperação usado pela segunda vez ou depois de 60 minutos | Sistema recusa e pede um novo link | 2º uso e link vencido: 400 "Link inválido ou expirado. Peça um novo." (vencimento simulado alterando `expira_em` no banco) | Aprovado |
| CT14 | RF01.6 | Nova senha com menos de 8 caracteres | Sistema recusa | 400 "A senha precisa ter pelo menos 8 caracteres." | Aprovado |
| CT15 | RF04.2 | Reivindicação com 4 arquivos de prova de posse | Sistema recusa (máximo de 3) | 400 "Envie no máximo 3 arquivos." | Aprovado |
| CT16 | RF04.2 | Outra pessoa tenta abrir o endereço de uma prova de posse | Acesso negado | 404 "Reivindicação não encontrada." (de propósito: não revela que a reivindicação existe); sem login, 401 | Aprovado |
| CT17 | RF05.4 | Relatório com data inicial depois da final | Sistema recusa e explica | 400 "A data inicial não pode ser depois da data final." | Aprovado |
| CT18 | RF05.5 | Exportar relatório com item cujo título começa com "=" | CSV abre no Excel sem executar fórmula | A célula sai como `'=HYPERLINK(...)`, com apóstrofo na frente | Aprovado no arquivo; conferir abrindo no Excel |
| CT19 | RNF01 | Abrir o site, uma página interna ou uma foto de item sem estar logado | Vai para a tela de login; depois de entrar, volta para a página pedida | `/` e páginas internas: 302 para `/login.html?voltar=...`; API de leitura: 401; endereços com `..`, `%2E` ou maiúsculas também barrados (incluído em 23/10/2026, teste automático em `test/http.test.ts`) | Aprovado |

## Caixa branca

Testes que olham o código: cobrem os desvios (if/else) das regras de negócio RN01 a RN05 e das funções dos models. São automáticos e ficam em `server/test/`.

### Como rodar

Na pasta `server/`:

```bash
npm test                # roda os 277 testes (cerca de 4 segundos)
npm run test:cobertura  # roda e mostra a cobertura de linhas e de desvios por arquivo
```

Usam o executor de testes do próprio Node (`node:test`), sem dependência nova. Cada arquivo de teste roda com um **banco temporário próprio**, criado e apagado sozinho: os testes nunca tocam no `data/campuslost.db`.

### O que cada arquivo cobre

| Arquivo | Camada | O que testa |
| --- | --- | --- |
| `test/module/Item.test.ts` | Model | Validações do item (RF02.1, RF02.4), status inicial por perfil (RF02.5) e **as 16 combinações** de mudança de status do ciclo de vida: 4 permitidas e 12 proibidas |
| `test/module/Reivindicacao.test.ts` | Model | Respostas obrigatórias, aprovar, rejeitar com motivo (CT09) e bloqueio de decidir duas vezes |
| `test/module/outras-entidades.test.ts` | Model | Usuario (senha só como hash), Devolucao (só tipo do documento), Categoria, Local, Mensagem, Foto, ProvaPosse, HistoricoStatus |
| `test/module/relatorio.test.ts` | Model | PeriodoDeDatas (CT17) e o CSV do relatório: BOM, `;`, aspas, vírgula decimal e proteção contra fórmula (CT18) |
| `test/services/regras-de-negocio.test.ts` | Service + banco | **RN01 a RN05**, um bloco para cada regra (tabela abaixo) |
| `test/services/ItemService.test.ts` | Service + banco | Registro, manutenção (RF02.6), busca com todos os filtros (RF03) e detalhe por perfil |
| `test/services/ReivindicacaoService.test.ts` | Service + banco | Abrir, rejeitar com e sem outras abertas, quem pode decidir, mensagens, não lidas, e-mail da decisão e provas |
| `test/services/UsuarioService.test.ts` | Service + banco | Gestão de contas: busca, mudar perfil, desativar e as travas (própria conta e último administrador) |
| `test/scripts/criarAdmin.test.ts` | Script + banco | `npm run criar-admin`: cria administrador novo, promove conta existente (mantendo a senha), reativa conta desativada e não muda nada com "n" |
| `test/services/autenticacao.test.ts` | Service + banco | Cadastro (RF01.1, RF01.2, RF01.5), login (CT02, CT03) e recuperação de senha (CT12 a CT14) |
| `test/database/migracao.test.ts` | Banco | Migração da MR01 (local em texto livre): monta um banco no formato antigo e confere que nenhum dado se perde e que as ligações entre tabelas continuam valendo |
| `test/http.test.ts` | API inteira | Servidor de verdade: login obrigatório no site inteiro (CT19), middlewares de login e perfil (CT11), upload (CT04, CT15, CT16), erros 400/404/500 e o fluxo completo até o CSV |

### Regras de negócio

| Regra | Desvios testados |
| --- | --- |
| RN01: devolução só com reivindicação aprovada | aberta, rejeitada, inexistente e documento inválido são recusados; aprovada registra e o item vira Devolvido; não registra duas vezes |
| RN02: no máximo uma aprovada por item | aprovar rejeita as outras abertas do mesmo item (e só dele); depois de aprovada ninguém mais reivindica; o índice único do banco também barra |
| RN03: devolvido some da busca, fica no histórico | some da busca e do detalhe público, a administração ainda vê; continua no histórico; a busca só lista Disponível |
| RN04: anúncio não mostra os detalhes da validação | detalhe público e busca não trazem as respostas; só o reivindicante e a administração as veem, os outros recebem 404 |
| RN05: toda mudança de status registra quem e quando | o ciclo completo gera 6 registros, cada um com o usuário certo; aprovar e uma segunda reivindicação não mudam o status e não geram registro; transição recusada não grava nada |

### Resultado de 23/10/2026

**277 testes, 277 aprovados** (24/10/2026, com o filtro de local, a ordenação da busca, a foto do item nas reivindicações, o contador de mensagens não lidas, o e-mail da decisão, a busca sem acento, o "Carregar mais", os itens parados, a gestão de usuários e o criar-admin que promove contas).

| Cobertura (`npm run test:cobertura`) | Linhas | Desvios (branches) | Funções |
| --- | --- | --- | --- |
| Total | 97,0% | 93,4% | 90,9% |

Os services (onde ficam as regras) e os models principais têm de 96% a 99% das linhas cobertas. Na leitura do relatório:

- **Linhas que são só `}` e os arquivos de enum** (`StatusItem`, `PerfilUsuario` etc.) aparecem como "não cobertas" por limitação da ferramenta com TypeScript, não por falta de teste.
- **Desvios reais sem teste, de propósito:**
  - envio de e-mail por SMTP de verdade (`EmailService`): exige um servidor de e-mail; o caminho sem SMTP (link no terminal) é testado;
  - falha interna do `express-session` ao criar ou destruir a sessão (`SessaoDaRequisicao`);
  - devolução de reivindicação aprovada cujo item sumiu (`DevolucaoService`): o banco não deixa isso acontecer (chave estrangeira), é só uma proteção extra;
  - `App.iniciar`, que só sobe o servidor numa porta fixa (os testes sobem numa porta livre).

### Observação encontrada pelos testes

No CSV, um **número negativo** também ganha o apóstrofo da proteção contra fórmula, por começar com `-` (fica `'-1`). Não afeta o relatório hoje, porque os dias até a devolução nunca são negativos, mas fica registrado.
