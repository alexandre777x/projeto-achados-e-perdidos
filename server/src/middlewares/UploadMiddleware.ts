import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { Request, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import { ErroDeNegocio } from "../module/ErroDeNegocio";

export interface RegrasDeUpload {
  pasta: string;
  campo: string;
  tiposAceitos: string[];
  tamanhoMaximo: number;
  maximoDeArquivos: number;
}

/**
 * Recebe arquivos de um formulário (multipart) e grava em disco com nome aleatório.
 * Usado nas fotos dos itens (RF02.2) e servirá para as provas de posse (RF04.2).
 * Confere os primeiros bytes de cada arquivo, porque o tipo informado pelo navegador
 * pode ser falsificado.
 */
export class UploadMiddleware {
  private static readonly EXTENSOES: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
  };

  /** Assinatura no começo de cada tipo de arquivo. */
  private static readonly ASSINATURAS: Record<string, number[]> = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  };

  private readonly receber: ReturnType<multer.Multer["array"]>;

  constructor(private readonly regras: RegrasDeUpload) {
    fs.mkdirSync(regras.pasta, { recursive: true });
    this.receber = multer({
      storage: multer.diskStorage({
        destination: regras.pasta,
        filename: (req, arquivo, cb) =>
          cb(null, randomBytes(16).toString("hex") + UploadMiddleware.EXTENSOES[arquivo.mimetype]),
      }),
      limits: { fileSize: regras.tamanhoMaximo, files: regras.maximoDeArquivos },
      defParamCharset: "utf8", // nomes de arquivo com acento chegam certos (o padrão é latin1)
      fileFilter: (req, arquivo, cb) => {
        if (!regras.tiposAceitos.includes(arquivo.mimetype)) {
          return cb(new ErroDeNegocio(`Tipo de arquivo não aceito: ${arquivo.originalname}.`));
        }
        cb(null, true);
      },
    }).array(regras.campo, regras.maximoDeArquivos);
  }

  public tratar(req: Request, res: Response, next: NextFunction): void {
    this.receber(req, res, (erro: unknown) => {
      if (erro) {
        UploadMiddleware.apagar(UploadMiddleware.arquivos(req));
        return next(this.traduzir(erro));
      }
      const falsos = UploadMiddleware.arquivos(req).filter((a) => !UploadMiddleware.conteudoConfere(a));
      if (falsos.length > 0) {
        UploadMiddleware.apagar(UploadMiddleware.arquivos(req));
        return next(new ErroDeNegocio(`O conteúdo de ${falsos[0].originalname} não é do tipo informado.`));
      }
      next();
    });
  }

  /** Arquivos recebidos nesta requisição (lista vazia se não veio nenhum). */
  public static arquivos(req: Request): Express.Multer.File[] {
    return Array.isArray(req.files) ? req.files : [];
  }

  /** Remove do disco arquivos que não vão mais ser usados (ex.: o cadastro falhou). */
  public static apagar(arquivos: { path: string }[]): void {
    for (const arquivo of arquivos) {
      fs.rm(arquivo.path, { force: true }, () => {});
    }
  }

  private traduzir(erro: unknown): Error {
    if (!(erro instanceof MulterError)) {
      return erro as Error;
    }
    const megas = Math.round(this.regras.tamanhoMaximo / (1024 * 1024));
    switch (erro.code) {
      case "LIMIT_FILE_SIZE":
        return new ErroDeNegocio(`Cada arquivo pode ter no máximo ${megas} MB.`);
      case "LIMIT_FILE_COUNT":
      case "LIMIT_UNEXPECTED_FILE":
        return new ErroDeNegocio(`Envie no máximo ${this.regras.maximoDeArquivos} arquivos.`);
      default:
        return new ErroDeNegocio("Não foi possível receber os arquivos.");
    }
  }

  private static conteudoConfere(arquivo: Express.Multer.File): boolean {
    const assinatura = UploadMiddleware.ASSINATURAS[arquivo.mimetype];
    const inicio = Buffer.alloc(assinatura.length);
    const fd = fs.openSync(arquivo.path, "r");
    try {
      fs.readSync(fd, inicio, 0, assinatura.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    return assinatura.every((byte, i) => inicio[i] === byte);
  }

  /** Nome com que o arquivo foi gravado na pasta (é o que vai para o banco). */
  public static nome(arquivo: { path: string }): string {
    return path.basename(arquivo.path);
  }
}
