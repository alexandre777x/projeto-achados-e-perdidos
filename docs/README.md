# Documentação

| Arquivo | O que é | Fase do Cascata |
| --- | --- | --- |
| `CampusLost_SRS.pdf` | Documento de Especificação de Requisitos de Software | 1. Requisitos |
| `mudancas-de-requisitos.md` | Mudanças feitas nos requisitos depois do SRS, com motivo e impacto (MR01: local em texto livre) | 1. Requisitos |

O modelo de domínio (diagrama de classes, MER e dicionário de dados) está no documento "CampusLost – Modelo de Domínio". O script SQL dele é `server/database/schema.sql`, e as classes ficam em `server/src/module/`.

## Diagramas UML (pasta `diagramas/`)

| Arquivo | O que mostra | Fase do Cascata |
| --- | --- | --- |
| `casos-de-uso.png` | Atores e casos de uso UC01 a UC11 | 2. Projeto |
| `sequencia-login.png` | Login: tela, controller, service, repositório e banco | 2. Projeto |
| `sequencia-registro-item.png` | Registro de item com fotos e status inicial por perfil | 2. Projeto |
| `sequencia-reivindicacao-devolucao.png` | Reivindicação, conversa, aprovação ou rejeição e devolução | 2. Projeto |

Cada diagrama tem também o `.svg` (para ampliar sem perder qualidade) e o código-fonte (`.mmd` do Mermaid, `.dot` do Graphviz) para editar e gerar de novo.
O UC11 (recuperar senha) foi acrescentado depois do SRS, a partir do RF01.6.
