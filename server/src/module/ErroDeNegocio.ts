/**
 * Erro esperado de uma regra do sistema (dado inválido, sem permissão, não encontrado...).
 * Carrega o status HTTP certo; o ErrorHandlerMiddleware responde com ele.
 * Qualquer outro erro vira 500.
 */
export class ErroDeNegocio extends Error {
  public readonly status: number;

  constructor(mensagem: string, status = 400) {
    super(mensagem);
    this.name = "ErroDeNegocio";
    this.status = status;
  }

  /** Para rotas que ainda não foram programadas: responde 501 com o requisito do SRS. */
  public static naoImplementado(requisito: string): ErroDeNegocio {
    return new ErroDeNegocio(`Ainda não implementado (${requisito}).`, 501);
  }
}
