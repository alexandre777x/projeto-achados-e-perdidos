import express, { Express } from "express";
import session from "express-session";
import { Configuracao } from "./config/Configuracao";
import { HealthController } from "./controllers/HealthController";
import { AutenticacaoController } from "./controllers/AutenticacaoController";
import { ItemController } from "./controllers/ItemController";
import { ReferenciaController } from "./controllers/ReferenciaController";
import { ReivindicacaoController } from "./controllers/ReivindicacaoController";
import { DevolucaoController } from "./controllers/DevolucaoController";
import { AutenticacaoMiddleware } from "./middlewares/AutenticacaoMiddleware";
import { ErrorHandlerMiddleware } from "./middlewares/ErrorHandlerMiddleware";
import { UploadMiddleware } from "./middlewares/UploadMiddleware";
import { Foto } from "./module/Foto";
import { Item } from "./module/Item";
import { ProvaPosse } from "./module/ProvaPosse";
import { Reivindicacao } from "./module/Reivindicacao";

/**
 * Monta a aplicação Express: sessão, arquivos do front-end (pasta client/),
 * fotos enviadas e as rotas da API (todas com prefixo /api).
 */
export class App {
  private readonly app: Express;
  private readonly api = express.Router();

  private readonly healthController = new HealthController();
  private readonly autenticacaoController = new AutenticacaoController();
  private readonly itemController = new ItemController();
  private readonly referenciaController = new ReferenciaController();
  private readonly reivindicacaoController = new ReivindicacaoController();
  private readonly devolucaoController = new DevolucaoController();
  private readonly autenticacaoMiddleware = new AutenticacaoMiddleware();
  private readonly errorHandlerMiddleware = new ErrorHandlerMiddleware();

  /** Qualquer usuário logado. */
  private readonly exigirLogin: express.RequestHandler = (req, res, next) =>
    this.autenticacaoMiddleware.exigirLogin(req, res, next);

  /** Só administrador (RNF01.1). */
  private readonly exigirAdmin: express.RequestHandler = (req, res, next) =>
    this.autenticacaoMiddleware.exigirAdmin(req, res, next);

  /** Fotos dos itens (RF02.2): de 1 a 3, JPG ou PNG, até 5 MB cada. */
  private readonly uploadDeFotos = new UploadMiddleware({
    pasta: Configuracao.pastaUploads,
    campo: "fotos",
    tiposAceitos: Foto.TIPOS_ACEITOS,
    tamanhoMaximo: Foto.TAMANHO_MAXIMO,
    maximoDeArquivos: Item.MAX_FOTOS,
  });

  private readonly receberFotos: express.RequestHandler = (req, res, next) =>
    this.uploadDeFotos.tratar(req, res, next);

  /** Provas de posse (RF04.2): até 3, JPG, PNG ou PDF de até 5 MB, na pasta privada. */
  private readonly uploadDeProvas = new UploadMiddleware({
    pasta: Configuracao.pastaProvas,
    campo: "provas",
    tiposAceitos: ProvaPosse.TIPOS_ACEITOS,
    tamanhoMaximo: ProvaPosse.TAMANHO_MAXIMO,
    maximoDeArquivos: Reivindicacao.MAX_PROVAS,
  });

  private readonly receberProvas: express.RequestHandler = (req, res, next) =>
    this.uploadDeProvas.tratar(req, res, next);

  constructor() {
    this.app = express();

    this.configurarMiddlewares();
    this.configurarArquivosEstaticos();
    this.configurarRotas();
    this.configurarTratamentoDeErros();
  }

  private configurarMiddlewares(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(
      session({
        name: Configuracao.COOKIE_SESSAO,
        secret: Configuracao.segredoSessao,
        resave: false,
        saveUninitialized: false,
        rolling: true, // renova o prazo a cada requisição (RNF01.2)
        cookie: { httpOnly: true, sameSite: "lax", maxAge: Configuracao.minutosSessao * 60 * 1000 },
      })
    );
  }

  /** Front-end (HTML, CSS e JS) e fotos dos itens. As provas de posse NÃO são públicas. */
  private configurarArquivosEstaticos(): void {
    this.app.use(express.static(Configuracao.PASTA_CLIENT));
    this.app.use("/uploads", express.static(Configuracao.pastaUploads));
  }

  private configurarRotas(): void {
    this.api.get("/saude", (req, res) => this.healthController.verificar(req, res));

    this.configurarRotasDeAutenticacao();
    this.configurarRotasDeItens();
    this.configurarRotasDeReferencias();
    this.configurarRotasDeReivindicacoes();
    this.configurarRotasDeDevolucoes();

    this.app.use("/api", this.api);
    this.app.use("/api", (req, res) => this.errorHandlerMiddleware.naoEncontrado(req, res));
  }

  /** RF01 */
  private configurarRotasDeAutenticacao(): void {
    const c = this.autenticacaoController;
    this.api.post("/auth/cadastro", (req, res) => c.cadastrar(req, res));
    this.api.post("/auth/login", (req, res) => c.entrar(req, res));
    this.api.post("/auth/logout", (req, res) => c.sair(req, res));
    this.api.get("/auth/eu", this.exigirLogin, (req, res) => c.perfil(req, res));
    this.api.post("/auth/recuperar-senha", (req, res) => c.solicitarRecuperacao(req, res));
    this.api.post("/auth/redefinir-senha", (req, res) => c.redefinirSenha(req, res));
  }

  /** RF02 e RF03 */
  private configurarRotasDeItens(): void {
    const c = this.itemController;
    this.api.get("/itens", (req, res) => c.buscar(req, res));
    // Antes de /itens/:id, senão "aguardando-recebimento" seria lido como um id.
    this.api.get("/itens/aguardando-recebimento", this.exigirAdmin, (req, res) => c.listarAguardandoRecebimento(req, res));
    this.api.get("/itens/:id", (req, res) => c.detalhar(req, res));
    // O login vem antes do upload: quem não entrou não chega a gravar arquivos.
    this.api.post("/itens", this.exigirLogin, this.receberFotos, (req, res) => c.registrar(req, res));
    this.api.patch("/itens/:id/recebimento", this.exigirAdmin, (req, res) => c.confirmarRecebimento(req, res));
    this.api.put("/itens/:id", this.exigirAdmin, (req, res) => c.editar(req, res));
    this.api.delete("/itens/:id", this.exigirAdmin, (req, res) => c.excluir(req, res));
  }

  /** RF02.3 */
  private configurarRotasDeReferencias(): void {
    const c = this.referenciaController;
    this.api.get("/referencias/categorias", (req, res) => c.listarCategorias(req, res));
    this.api.get("/referencias/locais", (req, res) => c.listarLocais(req, res));
    this.api.post("/referencias/categorias", this.exigirAdmin, (req, res) => c.criarCategoria(req, res));
    this.api.post("/referencias/locais", this.exigirAdmin, (req, res) => c.criarLocal(req, res));
  }

  /** RF04 */
  private configurarRotasDeReivindicacoes(): void {
    const c = this.reivindicacaoController;
    this.api.post("/reivindicacoes", this.exigirLogin, this.receberProvas, (req, res) => c.abrir(req, res));
    this.api.get("/reivindicacoes/minhas", this.exigirLogin, (req, res) => c.listarMinhas(req, res));
    this.api.get("/reivindicacoes", this.exigirAdmin, (req, res) => c.listarAbertas(req, res));
    // Depois de /minhas, senão "minhas" seria lido como um id.
    this.api.get("/reivindicacoes/:id", this.exigirLogin, (req, res) => c.detalhar(req, res));
    this.api.get("/reivindicacoes/:id/provas/:provaId", this.exigirLogin, (req, res) => c.baixarProva(req, res));
    this.api.get("/reivindicacoes/:id/mensagens", this.exigirLogin, (req, res) => c.listarMensagens(req, res));
    this.api.post("/reivindicacoes/:id/mensagens", this.exigirLogin, (req, res) => c.enviarMensagem(req, res));
    this.api.patch("/reivindicacoes/:id/aprovar", this.exigirAdmin, (req, res) => c.aprovar(req, res));
    this.api.patch("/reivindicacoes/:id/rejeitar", this.exigirAdmin, (req, res) => c.rejeitar(req, res));
  }

  /** RF05 */
  private configurarRotasDeDevolucoes(): void {
    const c = this.devolucaoController;
    this.api.post("/devolucoes", this.exigirAdmin, (req, res) => c.registrar(req, res));
    this.api.get("/devolucoes/pendentes", this.exigirAdmin, (req, res) => c.listarPendentes(req, res));
    this.api.get("/devolucoes/relatorio", this.exigirAdmin, (req, res) => c.relatorio(req, res));
    this.api.get("/devolucoes/relatorio.csv", this.exigirAdmin, (req, res) => c.relatorioCsv(req, res));
  }

  /** Precisa ser registrado DEPOIS das rotas: só assim o Express sabe que é um error handler. */
  private configurarTratamentoDeErros(): void {
    this.app.use((erro: Error, req: express.Request, res: express.Response, next: express.NextFunction) =>
      this.errorHandlerMiddleware.tratar(erro, req, res, next)
    );
  }

  public getExpressApp(): Express {
    return this.app;
  }

  public iniciar(porta: number): void {
    this.app.listen(porta, () => {
      console.log(`CampusLost rodando em http://localhost:${porta}`);
    });
  }
}
