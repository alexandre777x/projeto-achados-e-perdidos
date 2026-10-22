# CampusLost

Sistema web de achados e perdidos universitário. Mini-projeto de Engenharia de Software (processo Cascata).

Equipe: Antonio Alexandre, Mateus Augusto e João Victor.

## Tecnologias

- Front-end: HTML, CSS e JavaScript puro (pasta `public/`)
- Back-end: Node.js com Express
- Banco de dados: SQLite (arquivo local, sem instalação)

## Como rodar

Precisa do Node.js 18 ou mais novo.

```bash
# 1. Instalar as dependências (só na primeira vez)
npm install

# 2. Criar o arquivo de configuração
copy .env.example .env        # no Windows
# cp .env.example .env        # no Linux ou Mac

# 3. Subir o servidor
npm run dev
```

Abra http://localhost:3000. A página inicial mostra "Servidor ok" quando o servidor e o banco estão funcionando.
O banco é criado sozinho na primeira execução, a partir de `src/database/schema.sql`.
Se o `schema.sql` mudar, apague `data/campuslost.db` para o banco ser recriado (os dados de teste se perdem).

Sem e-mail configurado no `.env`, o link de recuperação de senha aparece no terminal do servidor.

## Estrutura de pastas

```
campuslost/
├── docs/                    documentação (SRS, diagramas)
├── public/                  front-end
│   ├── css/style.css
│   ├── js/api.js            função para chamar a API
│   └── *.html               páginas
├── src/                     back-end
│   ├── server.js            ponto de entrada
│   ├── app.js               configura o Express
│   ├── config/env.js        lê o .env
│   ├── database/            conexão, schema.sql, seed.sql, init.js
│   ├── middlewares/         login, perfil de administrador, erros
│   ├── routes/              quais endereços existem (um arquivo por assunto)
│   ├── controllers/         o que cada endereço faz
│   ├── models/              consultas SQL de cada tabela
│   └── services/email.js    envio de e-mail (recuperação de senha)
├── tests/                   plano de testes
├── uploads/                 fotos dos itens, públicas (não vai para o Git)
├── provas/                  provas de posse, privadas (não vai para o Git)
└── data/                    arquivo do banco (não vai para o Git)
```

O caminho de uma requisição é: `routes` → `controllers` → `models` → banco.

## Onde fica cada requisito

| Requisito | Rotas | Controller | Model | Páginas |
| --- | --- | --- | --- | --- |
| RF01 Cadastro e login | `auth.routes.js` | `autenticacao.controller.js` | `usuario.model.js` | `login.html`, `cadastro.html` |
| RF01.6 Recuperar senha ✅ | `auth.routes.js` | `autenticacao.controller.js` | `recuperacao-senha.model.js` | `esqueci-senha.html`, `redefinir-senha.html` |
| RF02 Registro de item | `itens.routes.js` | `itens.controller.js` | `item.model.js` | `novo-item.html` |
| RF03 Busca | `itens.routes.js` | `itens.controller.js` | `item.model.js` | `itens.html`, `item.html` |
| RF04 Reivindicação (com provas de posse) | `reivindicacoes.routes.js` | `reivindicacoes.controller.js` | `reivindicacao.model.js` | `item.html`, `minhas-reivindicacoes.html` |
| RF05 Devolução | `devolucoes.routes.js` | `devolucoes.controller.js` | `devolucao.model.js` | `admin.html` |
| RF05.4 e RF05.5 Relatório e CSV ✅ | `devolucoes.routes.js` | `devolucoes.controller.js` | `devolucao.model.js` | `admin.html` |

As rotas já existem e respondem "Ainda não implementado" até alguém programar o controller. Cada função tem o requisito do SRS no nome (por exemplo `aImplementar('RF01.3')`).

## Trabalhando em equipe com Git

Cada pessoa trabalha em um ramo (branch) próprio e junta no `main` por Pull Request.

```bash
git checkout -b feature/rf01-cadastro
# ... programar ...
git add .
git commit -m "RF01: cadastro de usuário"
git push -u origin feature/rf01-cadastro
```

Nunca envie o arquivo `.env` nem o banco (`data/`): o `.gitignore` já bloqueia os dois.
