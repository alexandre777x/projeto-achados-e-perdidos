import { Usuario } from "../module/Usuario";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { RecuperacaoSenhaRepository } from "../repositories/RecuperacaoSenhaRepository";

/**
 * Contas. Em "Meu perfil", a própria pessoa troca o nome e a senha. A administração
 * lista as contas, muda o perfil (RF01.5: só um administrador dá o perfil de
 * administrador) e desativa ou reativa. Duas travas na administração: ninguém mexe
 * na própria conta e sempre sobra um administrador ativo.
 */
export class UsuarioService {
  private readonly repositorio = new UsuarioRepository();
  private readonly recuperacao = new RecuperacaoSenhaRepository();

  public listar(busca: unknown): Usuario[] {
    const texto = String(busca ?? "").trim();
    if (texto.length > 100) {
      throw new ErroDeNegocio("A busca pode ter no máximo 100 caracteres.");
    }
    return this.repositorio.listar(texto);
  }

  public mudarPerfil(id: number, perfil: unknown, quemMudaId: number): Usuario {
    if (!Object.values(PerfilUsuario).includes(perfil as PerfilUsuario)) {
      throw new ErroDeNegocio("Perfil inválido.");
    }
    const novo = perfil as PerfilUsuario;
    return this.repositorio.emTransacao(() => {
      const usuario = this.buscarOutro(id, quemMudaId, "Você não pode mudar o seu próprio perfil.");
      if (usuario.ehAdministrador() && novo !== PerfilUsuario.ADMINISTRADOR && usuario.estaAtivo()) {
        this.exigirOutroAdministrador();
      }
      this.repositorio.atualizarPerfil(id, novo);
      return this.repositorio.buscarPorId(id) as Usuario;
    });
  }

  /** Conta desativada não entra mais, e quem estava logado com ela perde o acesso na hora. */
  public mudarAtivo(id: number, ativo: unknown, quemMudaId: number): Usuario {
    if (typeof ativo !== "boolean") {
      throw new ErroDeNegocio("Informe se a conta fica ativa (true) ou desativada (false).");
    }
    return this.repositorio.emTransacao(() => {
      const usuario = this.buscarOutro(id, quemMudaId, "Você não pode desativar a sua própria conta.");
      if (!ativo && usuario.ehAdministrador() && usuario.estaAtivo()) {
        this.exigirOutroAdministrador();
      }
      this.repositorio.atualizarAtivo(id, ativo);
      return this.repositorio.buscarPorId(id) as Usuario;
    });
  }

  /** Meu perfil: a própria pessoa troca o nome. O e-mail não muda, porque identifica a conta. */
  public atualizarMeuNome(id: number, nome: unknown): Usuario {
    const novo = Usuario.validarNome(nome);
    this.buscarExistente(id);
    this.repositorio.atualizarNome(id, novo);
    return this.repositorio.buscarPorId(id) as Usuario;
  }

  /**
   * Meu perfil: troca a senha conferindo a atual. A senha nova também invalida os links
   * de recuperação de senha que estiverem pendentes.
   */
  public async trocarMinhaSenha(id: number, senhaAtual: unknown, novaSenha: unknown): Promise<void> {
    const usuario = this.buscarExistente(id);
    if (!(await usuario.senhaConfere(String(senhaAtual ?? "")))) {
      throw new ErroDeNegocio("A senha atual não confere.");
    }
    if (senhaAtual === novaSenha) {
      throw new ErroDeNegocio("A senha nova precisa ser diferente da atual.");
    }
    this.recuperacao.trocarSenha(id, await Usuario.gerarHash(novaSenha as string));
  }

  private buscarExistente(id: number): Usuario {
    const usuario = this.repositorio.buscarPorId(id);
    if (!usuario) {
      throw new ErroDeNegocio("Conta não encontrada.", 404);
    }
    return usuario;
  }

  private buscarOutro(id: number, quemMudaId: number, mensagemSeForAPropria: string): Usuario {
    const usuario = this.repositorio.buscarPorId(id);
    if (!usuario) {
      throw new ErroDeNegocio("Conta não encontrada.", 404);
    }
    if (id === quemMudaId) {
      throw new ErroDeNegocio(mensagemSeForAPropria, 409);
    }
    return usuario;
  }

  /** Tirar este administrador não pode deixar o sistema sem nenhum. */
  private exigirOutroAdministrador(): void {
    if (this.repositorio.contarAdministradoresAtivos() <= 1) {
      throw new ErroDeNegocio("O sistema precisa de pelo menos um administrador ativo.", 409);
    }
  }
}
