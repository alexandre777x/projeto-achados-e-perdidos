import "dotenv/config";
import readline from "readline";
import { Database } from "../database/Database";
import { Usuario } from "../module/Usuario";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { UsuarioRepository } from "../repositories/UsuarioRepository";

/** Faz uma pergunta no terminal e devolve a resposta. */
export type Perguntar = (texto: string) => Promise<string>;

/**
 * Cria uma conta de administrador. Como o RF01.5 proíbe virar administrador pelo
 * cadastro, o primeiro precisa ser criado por aqui. Rode com: npm run criar-admin
 *
 * Se o e-mail já tiver conta (por exemplo, criada pelo site como aluno), oferece
 * transformá-la em administradora, mantendo a senha e tudo o que ela já tem.
 * Devolve a mensagem final para mostrar no terminal.
 */
export async function criarOuPromoverAdmin(perguntar: Perguntar): Promise<string> {
  const repositorio = new UsuarioRepository();
  const email = await perguntar("E-mail: ");
  const existente = repositorio.buscarPorEmail(email);

  if (existente) {
    const id = existente.getId() as number;
    if (existente.ehAdministrador() && existente.estaAtivo()) {
      return `${existente.getNome()} <${existente.getEmail()}> já é administrador. Nada foi alterado.`;
    }
    const desativada = existente.estaAtivo() ? "" : " (a conta está desativada e também será reativada)";
    const resposta = await perguntar(
      `Já existe a conta de ${existente.getNome()}, como ${existente.getPerfil().toLowerCase()}${desativada}.\n` +
        "Quer torná-la administradora? A senha continua a mesma. (s/n): "
    );
    if (!/^s(im)?$/i.test(resposta)) {
      return "Nada foi alterado.";
    }
    repositorio.emTransacao(() => {
      repositorio.atualizarPerfil(id, PerfilUsuario.ADMINISTRADOR);
      repositorio.atualizarAtivo(id, true);
    });
    return `${existente.getNome()} <${existente.getEmail()}> agora é administrador. Já pode entrar no site com a senha de sempre.`;
  }

  const nome = await perguntar("Nome: ");
  const senha = await perguntar(`Senha (mínimo ${Usuario.SENHA_MINIMA} caracteres): `);
  const admin = repositorio.salvar(await Usuario.comSenha(nome, email, senha, PerfilUsuario.ADMINISTRADOR));
  return `Administrador criado: ${admin.getNome()} <${admin.getEmail()}>. Já pode entrar no site.`;
}

async function executar(): Promise<void> {
  Database.getInstancia().inicializar();
  const terminal = readline.createInterface({ input: process.stdin });
  const linhas = terminal[Symbol.asyncIterator]();

  // Lê linha a linha: funciona digitando no terminal e também com as respostas vindas de um arquivo.
  const perguntar: Perguntar = async (texto) => {
    process.stdout.write(texto);
    const { value, done } = await linhas.next();
    if (done) {
      throw new Error("a entrada terminou antes de todas as respostas.");
    }
    return String(value).trim();
  };

  try {
    console.log(`\n${await criarOuPromoverAdmin(perguntar)}`);
  } finally {
    terminal.close();
  }
}

// Só roda sozinho quando chamado pelo npm run criar-admin; nos testes, a função é importada.
if (require.main === module) {
  executar().catch((erro) => {
    console.error(`\nNão foi possível criar o administrador: ${(erro as Error).message}`);
    process.exitCode = 1;
  });
}
