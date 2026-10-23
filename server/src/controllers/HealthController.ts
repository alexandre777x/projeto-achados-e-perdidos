import { Request, Response } from "express";
import { Database } from "../database/Database";

/** Confirma que a API e o banco estão de pé. Abra http://localhost:3000/api/saude */
export class HealthController {
  public verificar(req: Request, res: Response): void {
    res.json({ status: "ok", tabelas: Database.getInstancia().contarTabelas() });
  }
}
