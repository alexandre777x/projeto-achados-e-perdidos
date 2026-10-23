import bcrypt from "bcryptjs";
import { Usuario } from "../module/Usuario";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { UsuarioRepository } from "../repositories/UsuarioRepository";

/**
 * Login dos usuários (RF01.3). A sessão em si fica no express-session;
 * este serviço só confere as credenciais e quem está logado.
 */
export class AutenticacaoService {
  /** Usado quando o e-mail não existe, para o login demorar o mesmo tempo nos dois casos. */
  private static readonly HASH_FALSO = bcrypt.hashSync("senha-que-nao-existe", 10);

  private readonly repositorio = new UsuarioRepository();

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
