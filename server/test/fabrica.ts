import bcrypt from "bcryptjs";
import { Database } from "../src/database/Database";
import { PerfilUsuario } from "../src/module/PerfilUsuario";
import { StatusItem } from "../src/module/StatusItem";

/** Senha de todos os usuários criados pela fábrica. */
export const SENHA = "senha1234";
const HASH = bcrypt.hashSync(SENHA, 4); // custo baixo: só para os testes ficarem rápidos

let contador = 0;

function db() {
  return Database.getInstancia().getConexao();
}

/** Cria as tabelas e os dados iniciais (6 categorias). */
export function prepararBanco(): void {
  Database.getInstancia().inicializar();
}

export interface UsuarioCriado {
  id: number;
  email: string;
  perfil: PerfilUsuario;
}

export function criarUsuario(perfil = PerfilUsuario.ALUNO, ativo = true): UsuarioCriado {
  const email = `pessoa${++contador}@undb.edu.br`;
  const resultado = db()
    .prepare("INSERT INTO usuario (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?)")
    .run(`Pessoa ${contador}`, email, HASH, perfil, ativo ? 1 : 0);
  return { id: Number(resultado.lastInsertRowid), email, perfil };
}

export interface OpcoesItem {
  status?: StatusItem;
  titulo?: string;
  descricao?: string;
  dataAchado?: string;
  categoriaId?: number;
  local?: string;
  registradoPor: number;
  dataRegistro?: string;
}

/** Grava o item direto no banco, sem passar pelas regras: serve para montar cenários. */
export function criarItem(opcoes: OpcoesItem): number {
  const resultado = db()
    .prepare(
      `INSERT INTO item (titulo, descricao, data_achado, status, categoria_id, local_encontrado, registrado_por, data_registro)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      opcoes.titulo ?? `Item ${++contador}`,
      opcoes.descricao ?? "Descrição do item",
      opcoes.dataAchado ?? "2026-10-01",
      opcoes.status ?? StatusItem.DISPONIVEL,
      opcoes.categoriaId ?? 1,
      opcoes.local ?? "Bloco A, perto da escada",
      opcoes.registradoPor,
      opcoes.dataRegistro ?? null
    );
  return Number(resultado.lastInsertRowid);
}

export function statusDoItem(id: number): StatusItem {
  return (db().prepare("SELECT status FROM item WHERE id = ?").get(id) as { status: StatusItem }).status;
}

export interface LinhaHistorico {
  status_anterior: StatusItem | null;
  status_novo: StatusItem;
  usuario_id: number;
}

export function historicoDoItem(id: number): LinhaHistorico[] {
  return db()
    .prepare("SELECT status_anterior, status_novo, usuario_id FROM historico_status WHERE item_id = ? ORDER BY id")
    .all(id) as LinhaHistorico[];
}

/** Executa um comando SQL qualquer (ex.: forçar um link de senha a vencer). */
export function sql(comando: string, ...valores: unknown[]): void {
  db().prepare(comando).run(...valores);
}

export function contar(comando: string, ...valores: unknown[]): number {
  return (db().prepare(comando).get(...valores) as { n: number }).n;
}
