import "dotenv/config";
import { App } from "./App";
import { Configuracao } from "./config/Configuracao";
import { Database } from "./database/Database";

// Ponto de entrada: prepara o banco e sobe o servidor. Rode com: npm run dev
if (Database.getInstancia().inicializar()) {
  console.log("Banco criado com as tabelas e os dados iniciais.");
}

new App().iniciar(Configuracao.porta);
