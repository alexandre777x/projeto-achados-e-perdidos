import { Repositorio } from "./Repositorio";

/**
 * Tabelas item, foto e historico_status (RF02, RF03 e RN05).
 * A implementar:
 * - salvar(item, fotos): Item
 * - buscarPorId(id): Item | null
 * - buscar(filtros): Item[] — só DISPONIVEL, mais recentes primeiro (RF03.1 a RF03.4)
 * - mudarStatus(item, novoStatus, usuarioId) — grava também em historico_status (RN05)
 * - atualizar(item), deletar(id) (RF02.6)
 */
export class ItemRepository extends Repositorio {}
