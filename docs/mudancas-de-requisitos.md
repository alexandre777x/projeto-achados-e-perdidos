# Mudanças de requisitos

Registro das alterações feitas nos requisitos depois do SRS (`CampusLost_SRS.pdf`). No processo Cascata, toda mudança nos requisitos precisa ser registrada, com o motivo e o que ela afeta, antes de entrar no código.

## MR01 – Local do item em texto livre (23/10/2026)

**Requisitos afetados:** RF02.1, RF02.3, RF03.2 e RF03.3.

**Como era no SRS:**

- RF02.3: "A categoria e o local devem ser escolhidos em listas pré-cadastradas pelo administrador."
- RF03.2: a busca filtra por categoria, local e período.

**Como fica:**

- RF02.1: o usuário registra o item com título, descrição, categoria, **local onde foi encontrado (texto livre, de 3 a 150 caracteres)**, data e fotos.
- RF02.3: **a categoria** é escolhida na lista pré-cadastrada pelo administrador. O local deixa de ser uma lista.
- RF03.2: a busca filtra por categoria, período e **palavras do local**, isoladamente ou combinados.
- RF03.3: a busca por palavra-chave procura no título, na descrição **e no local**.

**Motivo:** os locais de uma lista fixa (por exemplo, "Bloco A" ou "Biblioteca") são amplos demais para ajudar o dono a reconhecer onde perdeu o objeto. Em texto livre, quem acha descreve um ponto de referência, como "banco em frente à cantina" ou "Bloco A, sala 104, embaixo da mesa".

**Consequência aceita:** sem a lista, não existe mais um filtro exato por local. O filtro de local da busca procura as palavras digitadas no texto do local ("cantina" encontra "banco em frente à cantina"), com sugestões como "Bloco A" e "Biblioteca". Depende de a pessoa digitar uma palavra que esteja no texto.

**O que mudou no sistema:**

| Parte | Mudança |
| --- | --- |
| Banco | A coluna `item.local_id` (ligada à tabela `local`) virou `item.local_encontrado` (texto). A tabela `local` foi removida. |
| Bancos que já existiam | Migração automática ao subir o servidor: cada item recebe o nome do local que tinha, e uma cópia do banco antigo fica em `campuslost.db.antes-local-em-texto.bak`. |
| API | `POST /api/itens` e `PUT /api/itens/:id` recebem `local` (texto) no lugar de `localId`. As rotas `/api/referencias/locais` foram removidas. Na busca, o filtro `local` passou a ser texto: cada palavra precisa aparecer no local. |
| Telas | Registro e edição de item com o campo "Onde foi encontrado"; busca com o campo "Local / bloco" em texto, com sugestões; administração sem o cadastro de locais. |
| Testes | CT06 revisado (abaixo). Testes automáticos novos para o local em texto e para a migração (`server/test/database/migracao.test.ts`). |

**Caso de teste revisado:** o CT06 era "Busca com categoria e local ao mesmo tempo". Passa a ser "Busca com categoria e uma palavra do local ao mesmo tempo".
