# Documentos históricos

Planes, guías de migración y notas que se escribieron mientras la app se construía, de febrero a
octubre de 2026. Estaban en la raíz del repositorio y se trasladaron aquí con `git mv` y **sin
editar**, así que `git log --follow` conserva su historia entera.

La única excepción son los datos privados, que se quitaron en septiembre de 2026, antes de
publicar el repositorio. El correo de la propietaria, el código de comercio (FUC) de producción,
claves y contraseñas se sustituyeron por marcadores entre `<…>`, y el guion de la reunión con
la propietaria del 19 de agosto se retiró. `tests/unit/no-private-data.test.ts` impide que
vuelvan a entrar.

**Son el registro de lo que era cierto cuando se escribieron, no de lo que es cierto hoy.** Los
estados que declaran («sin implementar», «pendiente de paso a producción»…) son de su fecha. Lo
vigente está en el código, en [`CLAUDE.md`](../../CLAUDE.md) y en el resto de [`docs/`](../).

> **Cuidado con los ficheros `.env`.** Todos estos documentos son anteriores al renombrado de
> entornos de septiembre de 2026. En ellos `.env` no significa lo que significa hoy: según la
> fecha, era la base SQLite de desarrollo o **la de producción**. Hoy `.env` apunta al Postgres
> local de Docker. Ninguna orden de estos documentos se debe copiar tal cual en una terminal. El
> esquema actual está en [`MASTER_IA.md`](../../MASTER_IA.md), apartado 0.2.

## Qué hay

| Documento | Fecha | Qué es |
|---|---|---|
| [`TODO.md`](TODO.md) | mar 2026 | Lista de funcionalidades pendientes de la primera versión |
| [`MIGRACION_SUPABASE.md`](MIGRACION_SUPABASE.md) | mar 2026 | Guía del paso de SQLite a Supabase (PostgreSQL) |
| [`PASARELA_PAGO.md`](PASARELA_PAGO.md) | mar 2026 | Plan de la integración con Redsys en modo redirección |
| [`MIGRACION_SUPABASE_3_ENTORNOS.md`](MIGRACION_SUPABASE_3_ENTORNOS.md) | abr 2026 | Guía para separar desarrollo, testing y producción en Supabase y Vercel |
| [`ASIENTOS_PARTIDOS_SOLAPADOS.md`](ASIENTOS_PARTIDOS_SOLAPADOS.md) | abr 2026 | Plan para que un asiento no se venda dos veces en partidos que se solapan |
| [`AUDITORIA_SEGURIDAD_ABRIL_2026.md`](AUDITORIA_SEGURIDAD_ABRIL_2026.md) | abr 2026 | Auditoría de seguridad y sus hallazgos, por gravedad |
| [`REDSYS.md`](REDSYS.md) | abr–ago 2026 | Configuración de Redsys por entorno: sandbox, producción y autoconfirmación |
| [`MIGRACION_API_FUTBOL.md`](MIGRACION_API_FUTBOL.md) | abr–ago 2026 | Cambio de proveedor de datos de fútbol, de football-data.org a ESPN |
| [`PASO_REDSYS_PRODUCCION.md`](PASO_REDSYS_PRODUCCION.md) | may 2026 | Plan para activar los pagos reales en producción |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | feb–ago 2026 | Diario del estado del desarrollo y de las funcionalidades hechas |
| [`PLAN_GASTOS_GESTION.md`](PLAN_GASTOS_GESTION.md) | ago 2026 | Gastos de gestión por asiento, importes en céntimos y desglose congelado |
| [`PLAN_EDITOR_ASIENTOS_V2.md`](PLAN_EDITOR_ASIENTOS_V2.md) | ago 2026 | Nombres reales de los asientos y editor para crear, editar y borrar |
| [`PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md`](PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md) | ago 2026 | Nombre del cliente en la reserva y recibo de pago que pide CaixaBank |
| [`PLAN_IMPLEMENTACION_MAIL_CLIENTE.md`](PLAN_IMPLEMENTACION_MAIL_CLIENTE.md) | sep 2026 | Email de confirmación con el ticket en PDF adjunto |
| [`PLAN_FUSION_PRODUCCION.md`](PLAN_FUSION_PRODUCCION.md) | oct 2026 | Paso de `academic` a `testing` y a producción: riesgos, orden, puertas y rollback |

## Por qué se conservan

Muestran cómo se trabajó: cada cambio con riesgo se planificó por escrito antes de tocar el código,
se repasó con la propietaria del bar o con otro ingeniero y se ejecutó después. Los planes recogen
también las alternativas descartadas y el porqué, algo que ni el código ni el `git log` guardan.
