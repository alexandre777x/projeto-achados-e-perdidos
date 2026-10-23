# CampusLost

Sistema web de achados e perdidos universitário. Mini-projeto de Engenharia de Software (processo Cascata).

Equipe: Antonio Alexandre, Mateus Augusto e João Victor.

## Tecnologias

| Parte do sistema | Tecnologia | Pasta |
| --- | --- | --- |
| Front-end | HTML, CSS e JavaScript | `client/` |
| Back-end | Node.js com Express e TypeScript | `server/` |
| Banco de dados | SQLite (arquivo local, sem instalação) | `server/data/` |

## Como rodar

Precisa do Node.js 20 ou mais novo. Todos os comandos rodam dentro da pasta `server/`.

```bash
cd server

# 1. Instalar as dependências (só na primeira vez)
npm install

# 2. Criar o arquivo de configuração
copy .env.example .env        # no Windows
# cp .env.example .env        # no Linux ou Mac

# 3. Criar o primeiro administrador (só na primeira vez)
npm run criar-admin

# 4. Subir o servidor
npm run dev
```

Abra http://localhost:3000. A página inicial mostra "Servidor ok" quando o servidor e o banco estão funcionando.

- O banco é criado sozinho na primeira execução, a partir de `server/database/schema.sql` e `seed.sql`.
  Se o `schema.sql` mudar, apague `server/data/campuslost.db` para o banco ser recriado (os dados de teste se perdem).
- O primeiro administrador precisa ser criado pelo `npm run criar-admin`, porque o RF01.5 proíbe virar administrador pelo cadastro.
- Sem e-mail configurado no `.env`, o link de recuperação de senha aparece no terminal do servidor.

| Comando (em `server/`) | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor e reinicia sozinho a cada alteração |
| `npm run build` | Confere os tipos e gera o JavaScript em `server/dist/` |
| `npm start` | Roda a versão gerada pelo build |
| `npm run criar-admin` | Cria uma conta de administrador |

## Estrutura de pastas

```
projeto-achados-e-perdidos/
├── client/                      front-end (servido pelo próprio servidor)
│   ├── css/style.css            cores da UNDB e componentes
│   ├── js/api.js                função para chamar a API
│   ├── js/menu.js               menu conforme quem está logado
│   └── *.html                   páginas
├── server/                      back-end em TypeScript
│   ├── database/                schema.sql e seed.sql
│   ├── src/
│   │   ├── server.ts            ponto de entrada
│   │   ├── App.ts               monta o Express e registra todas as rotas
│   │   ├── config/              Configuracao: lê o .env
│   │   ├── database/            Database: conexão com o SQLite
│   │   ├── module/              entidades e regras (Usuario, Item, Reivindicacao...)
│   │   ├── repositories/        consultas SQL, um por tabela
│   │   ├── services/            regras que usam mais de um repositório
│   │   ├── controllers/         um método por rota
│   │   ├── middlewares/         login, perfil de administrador, erros
│   │   ├── scripts/             criarAdmin
│   │   └── types/               tipos extras (dados da sessão)
│   ├── data/                    arquivo do banco (não vai para o Git)
│   ├── uploads/                 fotos dos itens, públicas (não vai para o Git)
│   └── provas/                  provas de posse, privadas (não vai para o Git)
├── docs/                        documentação (SRS, diagramas)
└── tests/                       plano de testes
```

O caminho de uma requisição é: `App.ts` (rota) → `controllers` → `services` → `repositories` → banco.
As classes de `module/` carregam as regras de negócio (validações, ciclo de vida do item) e são usadas em todas as camadas.

## Onde fica cada requisito

✅ = pronto. Os outros respondem "Ainda não implementado (RFxx)" até alguém programar o método no controller.

| Requisito | Controller | Service / Repository | Entidades | Páginas |
| --- | --- | --- | --- | --- |
| RF01.3 e RF01.4 Login e logout ✅ | `AutenticacaoController` | `AutenticacaoService`, `UsuarioRepository` | `Usuario` | `login.html` |
| RF01.1, RF01.2, RF01.5 Cadastro | `AutenticacaoController` | `UsuarioRepository` | `Usuario` | `cadastro.html` |
| RF01.6 Recuperar senha ✅ | `AutenticacaoController` | `RecuperacaoSenhaService`, `RecuperacaoSenhaRepository`, `EmailService` | `Usuario` | `esqueci-senha.html`, `redefinir-senha.html` |
| RF02 Registro de item ✅ | `ItemController` | `ItemService`, `ItemRepository`, `UploadMiddleware` | `Item`, `Foto`, `HistoricoStatus` | `novo-item.html`, `admin.html` |
| RF02.3 Categorias e locais ✅ | `ReferenciaController` | `CategoriaRepository`, `LocalRepository` | `Categoria`, `Local` | `admin.html`, `novo-item.html`, `itens.html` |
| RF03 Busca ✅ | `ItemController` | `ItemService`, `ItemRepository` | `Item` | `index.html`, `itens.html`, `item.html` |
| RF04 Reivindicação ✅ | `ReivindicacaoController` | `ReivindicacaoService`, `ReivindicacaoRepository` | `Reivindicacao`, `ProvaPosse`, `Mensagem` | `item.html`, `reivindicacao.html`, `minhas-reivindicacoes.html`, `admin.html` |
| RF05.1 a RF05.3 Devolução | `DevolucaoController` | `DevolucaoRepository` | `Devolucao` | `admin.html` |
| RF05.4 e RF05.5 Relatório e CSV ✅ | `DevolucaoController` | `RelatorioService`, `DevolucaoRepository` | `RelatorioDevolucoes`, `PeriodoDeDatas` | `admin.html` |

Os repositórios que ainda estão vazios trazem, no comentário do topo, a lista de métodos a implementar.

## Trabalhando em equipe com Git

Cada pessoa trabalha em um ramo (branch) próprio e junta no `main` por Pull Request.

```bash
git checkout -b feature/rf01-cadastro
# ... programar ...
git add .
git commit -m "RF01: cadastro de usuário"
git push -u origin feature/rf01-cadastro
```

Antes de abrir o Pull Request, rode `npm run build` em `server/` para conferir se não há erro de tipo.
Nunca envie o arquivo `.env` nem o banco (`server/data/`): o `.gitignore` já bloqueia os dois.
