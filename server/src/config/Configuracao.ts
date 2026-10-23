import path from "path";

/**
 * Lê as variáveis do .env e expõe as configurações do sistema em um só lugar.
 * Os caminhos são relativos à pasta server/.
 */
export class Configuracao {
  public static readonly PASTA_SERVER = path.resolve(__dirname, "..", "..");
  public static readonly PASTA_CLIENT = path.resolve(Configuracao.PASTA_SERVER, "..", "client");
  public static readonly PASTA_SQL = path.join(Configuracao.PASTA_SERVER, "database");

  public static readonly porta = Number(process.env.PORT) || 3000;
  public static readonly segredoSessao =
    process.env.SESSION_SECRET || "chave-apenas-para-desenvolvimento";
  public static readonly COOKIE_SESSAO = "campuslost.sid";
  /** RNF01.2: a sessão expira após 30 minutos sem uso. */
  public static readonly minutosSessao = 30;

  public static readonly caminhoBanco = Configuracao.caminho(process.env.DB_PATH, "data/campuslost.db");
  public static readonly pastaUploads = Configuracao.caminho(process.env.UPLOAD_DIR, "uploads");
  /** Provas de posse (RF04.2): pasta privada, fora de /uploads, para não ficar pública. */
  public static readonly pastaProvas = Configuracao.caminho(process.env.PROVAS_DIR, "provas");

  /** Domínio de e-mail aceito no cadastro (RF01.2). Vazio aceita qualquer um. */
  public static readonly dominioEmail = process.env.EMAIL_DOMINIO || "";

  /** Endereço do site, usado no link de recuperação de senha (RF01.6). */
  public static readonly urlBase = process.env.URL_BASE || `http://localhost:${Configuracao.porta}`;

  /** E-mail (RF01.6). Sem SMTP_HOST, o link aparece no terminal em vez de ser enviado. */
  public static readonly smtp = {
    host: process.env.SMTP_HOST || "",
    porta: Number(process.env.SMTP_PORT) || 587,
    usuario: process.env.SMTP_USER || "",
    senha: process.env.SMTP_PASS || "",
    remetente: process.env.EMAIL_REMETENTE || "CampusLost <nao-responda@campuslost.local>",
  };

  private static caminho(valor: string | undefined, padrao: string): string {
    return path.resolve(Configuracao.PASTA_SERVER, valor || padrao);
  }
}
