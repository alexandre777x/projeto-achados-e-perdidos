import fs from "fs";
import os from "os";
import path from "path";

/**
 * Importe este arquivo PRIMEIRO em todo teste que usa o banco.
 * Cada arquivo de teste roda num processo próprio, com banco e pastas temporários:
 * os testes nunca tocam no data/campuslost.db de desenvolvimento.
 * As variáveis precisam existir antes de a classe Configuracao ser carregada.
 */
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "campuslost-teste-"));

process.env.DB_PATH = path.join(pasta, "teste.db");
process.env.UPLOAD_DIR = path.join(pasta, "uploads");
process.env.PROVAS_DIR = path.join(pasta, "provas");
process.env.EMAIL_DOMINIO = "undb.edu.br";
process.env.SMTP_HOST = ""; // e-mails vão para o console, nunca para a rede

process.on("exit", () => {
  try {
    // require (e não import): só carrega o Database se algum teste já o usou
    require("../src/database/Database").Database.getInstancia().getConexao().close();
  } catch {
    // o banco nem chegou a ser aberto
  }
  fs.rmSync(pasta, { recursive: true, force: true });
});
