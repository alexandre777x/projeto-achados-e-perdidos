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
| CT06 | RF03.2 | Busca com categoria e local ao mesmo tempo | Lista só os itens que atendem aos dois filtros | Só o item que atende aos dois filtros | Aprovado |
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

## Caixa branca (a preencher na implementação)

Testes que olham o código: cobrir os desvios (if/else) das regras de negócio RN01 a RN05 e das funções dos models.
