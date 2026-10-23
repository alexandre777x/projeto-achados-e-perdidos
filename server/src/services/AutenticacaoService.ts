import bcrypt from "bcryptjs";
import { Configuracao } from "../config/Configuracao";
import { Usuario } from "../module/Usuario";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { UsuarioRepository } from "../repositories/UsuarioRepository";

export interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
}

/**
 * Cadastro (RF01.1, RF01.2, RF01.5) e login (RF01.3) dos usuários. A sessão em si fica
 * no express-session; este serviço só confere os dados, as credenciais e quem está logado.
 */
export class AutenticacaoService {
  /** Usado quando o e-mail não existe, para o login demorar o mesmo tempo nos dois casos. */
  private static readonly HASH_FALSO = bcrypt.hashSync("senha-que-nao-existe", 10);

  private readonly repositorio = new UsuarioRepository();

  /**
   * Cria a conta. Quem se cadastra sozinho escolhe aluno ou professor; o perfil
   * administrador só pode ser dado por outro administrador (RF01.5).
   */
  public async cadastrar(dados: DadosCadastro, perfilDeQuemCadastra: PerfilUsuario | null): Promise<Usuario> {
    if (dados.perfil === PerfilUsuario.ADMINISTRADOR && perfilDeQuemCadastra !== PerfilUsuario.ADMINISTRADOR) {
      throw new ErroDeNegocio("Só um administrador pode criar outra conta de administrador.", 403);
    }

    // O construtor valida nome, formato do e-mail, perfil e senha.
    const usuario = await Usuario.comSenha(dados.nome, dados.email, dados.senha, dados.perfil);
    AutenticacaoService.exigirDominioInstitucional(usuario.getEmail());

    if (this.repositorio.buscarPorEmail(usuario.getEmail())) {
      throw new ErroDeNegocio("Já existe uma conta com este e-mail.", 409);
    }
    try {
      return this.repositorio.salvar(usuario);
    } catch (erro) {
      // Dois cadastros com o mesmo e-mail ao mesmo tempo: o UNIQUE do banco barra o segundo.
      if ((erro as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new ErroDeNegocio("Já existe uma conta com este e-mail.", 409);
      }
      throw erro;
    }
  }

  /** RF01.2: com EMAIL_DOMINIO no .env, só aceita e-mails desse domínio. */
  private static exigirDominioInstitucional(email: string): void {
    const dominio = Configuracao.dominioEmail.trim().toLowerCase().replace(/^@/, "");
    if (dominio && !email.endsWith(`@${dominio}`)) {
      throw new ErroDeNegocio(`Use seu e-mail institucional (@${dominio}).`);
    }
  }

  /** Confere e-mail e senha e devolve o usuário. */
  public async entrar(email: string, senha: string): Promise<Usuario> {
    if (!email || !senha) {
      throw new ErroDeNegocio("Informe o e-mail e a senha.");
    }

    const usuario = this.repositorio.buscarPorEmail(email);
    const senhaCerta = usuario
      ? await usuario.senhaConfere(senha)
      : await bcrypt.compare(String(senha), AutenticacaoService.HASH_FALSO);

    // Mesma mensagem para e-mail inexistente e senha errada, para não revelar quais e-mails têm conta.
    if (!usuario || !senhaCerta) {
      throw new ErroDeNegocio("E-mail ou senha inválidos.", 401);
    }
    if (!usuario.estaAtivo()) {
      throw new ErroDeNegocio("Esta conta está desativada. Procure a administração.", 403);
    }
    return usuario;
  }

  /** Usuário da sessão, buscado de novo no banco; null se ele foi excluído ou desativado. */
  public usuarioLogado(id: number): Usuario | null {
    const usuario = this.repositorio.buscarPorId(id);
    return usuario && usuario.estaAtivo() ? usuario : null;
  }
}
