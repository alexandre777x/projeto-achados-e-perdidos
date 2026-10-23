PRAGMA foreign_keys = ON;

CREATE TABLE usuario (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL CHECK (length(nome) BETWEEN 3 AND 100),
    email         TEXT NOT NULL UNIQUE,
    senha_hash    TEXT NOT NULL,
    perfil        TEXT NOT NULL CHECK (perfil IN ('ALUNO','PROFESSOR','ADMINISTRADOR')),
    data_cadastro TEXT NOT NULL DEFAULT (datetime('now')),
    ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1))
);

CREATE TABLE categoria (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE local (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE item (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo         TEXT NOT NULL CHECK (length(titulo) BETWEEN 3 AND 80),
    descricao      TEXT NOT NULL CHECK (length(descricao) <= 1000),
    data_achado    TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'AGUARDANDO_RECEBIMENTO'
                   CHECK (status IN ('AGUARDANDO_RECEBIMENTO','DISPONIVEL','EM_REIVINDICACAO','DEVOLVIDO')),
    data_registro  TEXT NOT NULL DEFAULT (datetime('now')),
    categoria_id   INTEGER NOT NULL REFERENCES categoria(id),
    local_id       INTEGER NOT NULL REFERENCES local(id),
    registrado_por INTEGER NOT NULL REFERENCES usuario(id)
);
CREATE INDEX idx_item_busca ON item (status, categoria_id, local_id, data_achado);

CREATE TABLE foto (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    caminho TEXT NOT NULL,
    item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE
);

CREATE TABLE reivindicacao (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    status              TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','APROVADA','REJEITADA')),
    respostas_validacao TEXT NOT NULL CHECK (length(respostas_validacao) <= 2000),
    motivo_rejeicao     TEXT CHECK (length(motivo_rejeicao) <= 500),
    data_abertura       TEXT NOT NULL DEFAULT (datetime('now')),
    data_decisao        TEXT,
    item_id             INTEGER NOT NULL REFERENCES item(id),
    reivindicante_id    INTEGER NOT NULL REFERENCES usuario(id),
    decidido_por        INTEGER REFERENCES usuario(id),
    CHECK (status <> 'REJEITADA' OR motivo_rejeicao IS NOT NULL)
);
-- no máximo uma reivindicação aberta por usuário e item (RF04.6)
CREATE UNIQUE INDEX uq_reiv_aberta ON reivindicacao (item_id, reivindicante_id) WHERE status = 'ABERTA';
-- no máximo uma reivindicação aprovada por item (RN02)
CREATE UNIQUE INDEX uq_reiv_aprovada ON reivindicacao (item_id) WHERE status = 'APROVADA';

-- Arquivos que o reivindicante anexa para provar que é o dono (RF04.2): nota fiscal, foto antiga etc.
-- Ficam na pasta privada provas/, que NÃO é servida publicamente (RNF09).
CREATE TABLE prova_posse (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    caminho          TEXT NOT NULL,
    nome_original    TEXT NOT NULL,
    reivindicacao_id INTEGER NOT NULL REFERENCES reivindicacao(id) ON DELETE CASCADE
);

CREATE TABLE mensagem (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    texto            TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 1000),
    data_envio       TEXT NOT NULL DEFAULT (datetime('now')),
    reivindicacao_id INTEGER NOT NULL REFERENCES reivindicacao(id) ON DELETE CASCADE,
    autor_id         INTEGER NOT NULL REFERENCES usuario(id)
);

CREATE TABLE devolucao (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora        TEXT NOT NULL DEFAULT (datetime('now')),
    tipo_documento   TEXT NOT NULL CHECK (tipo_documento IN ('RG','CNH','CARTEIRA_ESTUDANTIL','OUTRO')),
    reivindicacao_id INTEGER NOT NULL UNIQUE REFERENCES reivindicacao(id),
    administrador_id INTEGER NOT NULL REFERENCES usuario(id)
);

CREATE TABLE historico_status (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    status_anterior TEXT,
    status_novo     TEXT NOT NULL,
    data_hora       TEXT NOT NULL DEFAULT (datetime('now')),
    item_id         INTEGER NOT NULL REFERENCES item(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id)
);

-- Pedidos de troca de senha (RF01.6). Guarda só o hash do token; o token puro vai apenas no e-mail.
CREATE TABLE recuperacao_senha (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    expira_em  TEXT NOT NULL,
    usado      INTEGER NOT NULL DEFAULT 0 CHECK (usado IN (0,1)),
    usuario_id INTEGER NOT NULL REFERENCES usuario(id)
);
