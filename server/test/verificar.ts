import assert from "node:assert/strict";
import { ErroDeNegocio } from "../src/module/ErroDeNegocio";

/**
 * Para usar com assert.throws: confere que o erro é um ErroDeNegocio com o status
 * HTTP esperado e, se informado, um trecho da mensagem.
 *   assert.throws(() => algo(), erroDeNegocio(409, "já foi decidida"));
 */
export function erroDeNegocio(status: number, trecho?: string) {
  return (erro: unknown): boolean => {
    assert.ok(erro instanceof ErroDeNegocio, `esperava ErroDeNegocio, veio ${String(erro)}`);
    assert.equal(erro.status, status, `status: "${erro.message}"`);
    if (trecho) {
      assert.match(erro.message, new RegExp(trecho, "i"));
    }
    return true;
  };
}
