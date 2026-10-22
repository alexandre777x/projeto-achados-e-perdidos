# Plano de testes do CampusLost

Fase 4 do Cascata. Os casos abaixo são o começo da **caixa preta** (testa o que o sistema faz, sem olhar o código). Cada caso vem de um requisito do SRS. Preencha as duas últimas colunas ao executar.

| ID | Requisito | Entrada | Resultado esperado | Resultado obtido | Situação |
| --- | --- | --- | --- | --- | --- |
| CT01 | RF01.2 | Cadastro com e-mail já existente | Sistema recusa e informa que o e-mail já está em uso | | |
| CT02 | RF01.3 | Login com senha correta | Sessão iniciada | | |
| CT03 | RF01.3 | Login com senha errada | Acesso negado, sem iniciar sessão | | |
| CT04 | RF02.2 | Registro de item com 4 fotos | Sistema recusa (máximo de 3 fotos) | | |
| CT05 | RF02.4 | Registro com data do achado no futuro | Sistema recusa | | |
| CT06 | RF03.2 | Busca com categoria e local ao mesmo tempo | Lista só os itens que atendem aos dois filtros | | |
| CT07 | RF03.4 | Busca sem nenhum resultado | Mensagem clara de que nada foi encontrado | | |
| CT08 | RF04.6 | Mesmo usuário reivindica o mesmo item duas vezes | Segunda tentativa é recusada | | |
| CT09 | RF04.4 | Administrador rejeita reivindicação sem informar o motivo | Sistema exige o motivo | | |
| CT10 | RF05.1 | Devolução de item sem reivindicação aprovada | Sistema recusa | | |
| CT11 | RNF01.1 | Aluno chama uma rota de administração | Resposta 403 | | |

## Caixa branca (a preencher na implementação)

Testes que olham o código: cobrir os desvios (if/else) das regras de negócio RN01 a RN05 e das funções dos models.
