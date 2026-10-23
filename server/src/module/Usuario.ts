import bcrypt from "bcryptjs";
import { ErroDeNegocio } from "./ErroDeNegocio";
import { PerfilUsuario } from "./PerfilUsuario";

/** Aluno, professor ou administrador (RF01). A senha só existe como hash (RNF01). */
export class Usuario {
  public static readonly SENHA_MINIMA = 8;
  private static readonly CUSTO_BCRYPT = 10;

  private id?: number;
  private nome: string;
  private email: string;
  private senhaHash: string;
  private perfil: PerfilUsuario;
  private ativo: boolean;
  private dataCadastro?: string;

  constructor(
    nome: string,
    email: string,
    senhaHash: string,
    perfil: PerfilUsuario,
    id?: number,
    ativo = true,
    dataCadastro?: string
  ) {
    nome = String(nome ?? "").trim();
    email = String(email ?? "").trim().toLowerCase();

    if (nome.length < 3 || nome.length > 100) {
      throw new ErroDeNegocio("O nome precisa ter entre 3 e 100 caracteres.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErroDeNegocio("Informe um e-mail válido.");
    }
    if (!Object.values(PerfilUsuario).includes(perfil)) {
      throw new ErroDeNegocio("Perfil inválido.");
    }

    this.nome = nome;
    this.email = email;
    this.senhaHash = senhaHash;
    this.perfil = perfil;
    this.id = id;
    this.ativo = ativo;
    this.dataCadastro = dataCadastro;
  }

  /** Cria um usuário novo a partir da senha digitada, já guardando só o hash. */
  public static async comSenha(
    nome: string,
    email: string,
    senha: string,
    perfil: PerfilUsuario
  ): Promise<Usuario> {
    return new Usuario(nome, email, await Usuario.gerarHash(senha), perfil);
  }

  public static async gerarHash(senha: string): Promise<string> {
    Usuario.validarSenha(senha);
    return bcrypt.hash(senha, Usuario.CUSTO_BCRYPT);
  }

  public static validarSenha(senha: string): void {
    if (typeof senha !== "string" || senha.length < Usuario.SENHA_MINIMA) {
      throw new ErroDeNegocio(`A senha precisa ter pelo menos ${Usuario.SENHA_MINIMA} caracteres.`);
    }
  }

  public senhaConfere(senha: string): Promise<boolean> {
    return bcrypt.compare(String(senha ?? ""), this.senhaHash);
  }

  public getId(): number | undefined {
    return this.id;
  }

  public getNome(): string {
    return this.nome;
  }

  public getEmail(): string {
    return this.email;
  }

  public getSenhaHash(): string {
    return this.senhaHash;
  }

  public getPerfil(): PerfilUsuario {
    return this.perfil;
  }

  public estaAtivo(): boolean {
    return this.ativo;
  }

  public ehAdministrador(): boolean {
    return this.perfil === PerfilUsuario.ADMINISTRADOR;
  }

  /** Nunca inclui o hash da senha. */
  public toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      perfil: this.perfil,
      ativo: this.ativo,
      dataCadastro: this.dataCadastro,
    };
  }
}
