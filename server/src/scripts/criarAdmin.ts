import "dotenv/config";
import readline from "readline";
import { Database } from "../database/Database";
import { Usuario } from "../module/Usuario";
import { PerfilUsuario } from "../module/PerfilUsuario";
import { UsuarioRepository } from "../repositories/UsuarioRepository";

/**
 * Cria uma conta de administrador. Como o RF01.5 proíbe virar administrador pelo
 * cadastro, o primeiro precisa ser criado por aqui. Rode com: npm run criar-admin
 */
async function criarAdmin(): Promise<void> {
  Database.getInstancia().inicializar();
  const repositorio = new UsuarioRepository();
  const terminal = readline.createInterface({ input: process.stdin });
  const linhas = terminal[Symbol.asyncIterator]();

  // Lê linha a linha: funciona digitando no terminal e também com as respostas vindas de um arquivo.
  const perguntar = async (texto: string): Promise<string> => {
    process.stdout.write(texto);
    const { value, done } = await linhas.next();
    if (done) {
      throw new Error("a entrada terminou antes de todas as respostas.");
    }
    return String(value).trim();
  };

  try {
    const nome = await perguntar("Nome: ");
    const email = await perguntar("E-mail: ");
    const senha = await perguntar(`Senha (mínimo ${Usuario.SENHA_MINIMA} caracteres): `);

    if (repositorio.buscarPorEmail(email)) {
      throw new Error("Já existe uma conta com este e-mail.");
    }
    const admin = repositorio.salvar(await Usuario.comSenha(nome, email, senha, PerfilUsuario.ADMINISTRADOR));
    console.log(`\nAdministrador criado: ${admin.getNome()} <${admin.getEmail()}>. Já pode entrar no site.`);
  } finally {
    terminal.close();
  }
}

criarAdmin().catch((erro) => {
  console.error(`\nNão foi possível criar o administrador: ${(erro as Error).message}`);
  process.exitCode = 1;
});
