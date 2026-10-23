import "express-session";
import { PerfilUsuario } from "../module/PerfilUsuario";

declare module "express-session" {
  interface SessionData {
    /** Quem está logado. Gravado no login (RF01.3) e apagado no logout (RF01.4). */
    usuario: {
      id: number;
      nome: string;
      perfil: PerfilUsuario;
    };
  }
}
