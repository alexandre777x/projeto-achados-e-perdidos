import { Repositorio } from "./Repositorio";
import { Usuario } from "../module/Usuario";
import { PerfilUsuario } from "../module/PerfilUsuario";

interface LinhaUsuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: PerfilUsuario;
  data_cadastro: string;
  ativo: number;
}

/** Tabela usuario (RF01). */
export class UsuarioRepository extends Repositorio {
  public salvar(usuario: Usuario): Usuario {
    const resultado = this.db
      .prepare("INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)")
      .run(usuario.getNome(), usuario.getEmail(), usuario.getSenhaHash(), usuario.getPerfil());
    return this.buscarPorId(Number(resultado.lastInsertRowid)) as Usuario;
  }

  public buscarPorId(id: number): Usuario | null {
    const linha = this.db.prepare<[number], LinhaUsuario>("SELECT * FROM usuario WHERE id = ?").get(id);
    return linha ? this.paraUsuario(linha) : null;
  }

  /** O e-mail é comparado sem diferenciar maiúsculas de minúsculas. */
  public buscarPorEmail(email: string): Usuario | null {
    const linha = this.db
      .prepare<[string], LinhaUsuario>("SELECT * FROM usuario WHERE email = ? COLLATE NOCASE")
      .get(String(email ?? "").trim());
    return linha ? this.paraUsuario(linha) : null;
  }

  private paraUsuario(linha: LinhaUsuario): Usuario {
    return new Usuario(
      linha.nome,
      linha.email,
      linha.senha_hash,
      linha.perfil,
      linha.id,
      linha.ativo === 1,
      linha.data_cadastro
    );
  }
}
