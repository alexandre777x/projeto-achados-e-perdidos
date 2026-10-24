import { Usuario } from "../module/Usuario";
import { ErroDeNegocio } from "../module/ErroDeNegocio";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { UsuarioRepository } from "../repositories/UsuarioRepository";

/**
 * Gestão das contas pela administração: listar, mudar o perfil (RF01.5: só um
 * administrador dá o perfil de administrador) e desativar ou reativar.
 * Duas travas: ninguém mexe na própria conta e sempre sobra um administrador ativo.
 */
export class UsuarioService {
  private readonly repositorio = new UsuarioRepository();

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
