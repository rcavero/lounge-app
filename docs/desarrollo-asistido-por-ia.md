# Desarrollo asistido por IA

Esta aplicación la ha desarrollado una sola persona, Ramón Cavero, trabajando con un asistente de
IA: Claude Code, con modelos Claude de Anthropic. Los commits en los que escribió la IA lo
indican con una línea `Co-Authored-By`.

Este documento no defiende que la IA programe bien. Cuenta **cómo se organizó el trabajo para
poder fiarse del resultado**: qué decidió cada uno, qué controles se pusieron, qué encontró la IA
que no buscaba nadie, y **qué hizo mal y qué lo detectó**. Esa última parte es la más importante.

Las fuentes son verificables: los planes de [`historico/`](historico/), el registro paso a paso
de [`MASTER_IA.md`](../MASTER_IA.md), el `git log` y las tarjetas del proyecto en Linear.

## El marco de trabajo

### Planificar por escrito antes de tocar nada

Cada cambio con riesgo empezó por un plan en Markdown, versionado en el repositorio: qué se cambia,
qué se descarta y por qué, cómo se comprueba, y qué decisiones quedan pendientes y de quién son.
Ramón los revisaba con la propietaria del bar (negocio y coste) y con otro ingeniero (técnica), a
veces durante días, antes de ejecutar nada. Pedir un plan no era pedir que se implementara.

Los planes de la pasarela de pago, los gastos de gestión, el nombre del cliente, los entornos y la
migración de proveedor de datos están en [`historico/`](historico/), tal como se escribieron. La
entrega del máster tiene el suyo en `MASTER_IA.md`, y cada paso ejecutado registra en qué se
desvió del plan.

### `CLAUDE.md`: el contrato que lee la IA

[`CLAUDE.md`](../CLAUDE.md) es lo primero que lee el asistente en cada sesión. No describe el
código, que la IA puede leer por su cuenta: recoge **lo que el código no dice**. Por ejemplo:
- por qué `Seat.id` no se toca nunca;
- por qué el recibo no puede ser una server action;
- por qué el sync no debe pisar un escudo local;
- qué tiene de especial la migración de gastos de gestión.

Son las reglas que, si se rompen, rompen algo caro. Cada cambio que las modifica actualiza el
fichero en el mismo commit.

### Scripts que comprueban antes y después

Las operaciones delicadas sobre datos reales tienen un script con un modo que solo informa y otro
que escribe:
- `rename-seats.ts report|apply`;
- `verify-management-fee.ts precheck|report`;
- `sync-verify.ts snapshot|report`.

`db-whoami.ts` imprime a qué base está conectado cada entorno antes de cualquier operación
remota. Son la red frente a un cambio generado que parece correcto y no lo es: el resultado se
mide, no se supone.

### Registro y trazabilidad

Cada paso tiene su tarjeta en Linear, con los desvíos y cómo se verificó. Cada commit dice por qué
se hizo y referencia su tarjeta. La IA mantiene además una memoria entre sesiones: el estado del
trabajo, las decisiones cerradas y las lecciones de sus propios errores, para no repetirlos.

## Quién decidió qué

La regla fue sencilla: **la IA propone con opciones y su coste, y la persona decide lo que es
suyo**. Lo técnico lo decidió la IA, y lo dejó escrito con su porqué, para poder revisarlo.

| Lo decidió Ramón | Lo decidió la IA |
|---|---|
| El orden de la entrega: primero los fallos de dinero, después la interfaz, y documentar al final, cuando el producto ya no cambie | Apoyarse en el bloqueo de filas de Postgres para la carrera de asientos, sin subir el aislamiento a `SERIALIZABLE` |
| Qué hacer con un pago que llega tarde: recuperar los asientos o devolver el dinero | Representar «cobrada y anulada» con estados que ya existían, sin migración |
| Aplicar el arreglo de la carrera en producción, sin esperar a fusionar | Que el WORKER vea el aviso de devolución pero no pueda marcarlo |
| Arreglar los tres fallos de seguridad antes de seguir documentando | La forma de los estados de carga: `loading.tsx`, `useLinkStatus` y animaciones que respetan «reducir movimiento» |
| Aplicar una migración en la base de testing compartida | Medir la cobertura solo en dominio, `lib/` y configuración |
| Renombrar el fichero de entorno de producción | Qué tests escribir y cómo demostrar que sirven |
| Cada pago real de la puerta, y la comprobación final en el móvil | |

Hubo decisiones que la IA no podía tomar ni aunque quisiera, porque exigen algo que no tiene: una
tarjeta para pagar, acceso al panel de Vercel, o saber qué quiere el negocio. Donde el diseño
dependía de un dato que la IA no podía observar, la pregunta correcta era pedirlo, no suponerlo
(ver el error 6, más abajo).

## Los controles que funcionaron

Los que más valieron fueron pasos cuyo único propósito era comprobar algo, y que casi no
produjeron código.

- **La puerta del pago real.** Todo cambio en el camino del dinero se queda en local hasta que
  Ramón paga en la preview. Después se sube, se vuelve a pagar en el mismo evento y la IA compara
  las dos reservas en la base de testing, en solo lectura. Es un control que la IA no puede
  saltarse, porque exige una tarjeta.
- **La prueba de humo antes de construir encima.** El plan daba a `academic` un esquema propio en
  la base de testing, con una prueba previa para una sola pregunta: ¿respeta el pooler el
  `search_path`? No lo respetaba, y tumbó el diseño antes de que dos ramas se pisaran los datos
  ([ADR 0006](adr/0006-una-base-de-datos-por-entorno.md)).
- **La auditoría del historial antes de pensar en publicar.** Encontró el `AUTH_SECRET` de
  producción commiteado desde hacía seis meses y una copia de la base con correos y hashes de
  contraseña. Se borraron del historial y se rotó el secreto.
- **El test rojo primero.** Ningún fallo se arregló sin un test que lo reprodujera y se viera
  fallar.
- **Las mutaciones.** Romper a propósito la regla que protege un test y comprobar que falla ese
  test. Así se descubrió, por ejemplo, un test del cron que pasaba por el motivo equivocado.
- **El canario del E2E.** Playwright protegía su proceso, pero quien escribe al pagar es el
  servidor. El canario comprueba que el servidor lee la base de tests, y **se probó que salta**,
  levantando a propósito uno contra la base equivocada.

## Lo que la IA encontró sin que nadie lo buscara

Escribir tests contra la base real, y después documentar, obligó a leer el código de verdad, y
salieron fallos que llevaban meses en producción:

| Hallazgo | Cómo salió |
|---|---|
| **Un pago que llegaba con la reserva caducada se cobraba sin asientos** | Un test de integración del webhook |
| **Dos clientes simultáneos podían comprar el mismo asiento** | Leyendo `initializePayment` para planificar los tests |
| **Una segunda carrera: la caducidad podía marcar como caducada una reserva recién pagada** | Diseñando el arreglo del pago tardío |
| **La ventana de reserva solo la comprobaba la portada**: por enlace directo se compraba un partido que empezaba en una hora | Caracterizando las reglas de la ventana |
| **El rol WORKER solo se limitaba en el menú**: por URL podía borrar eventos con reservas pagadas | Escribiendo la arquitectura |
| **Con el nº de pedido, que se adivina, se veía o cancelaba la reserva de otro cliente** | Escribiendo la arquitectura |
| **Un `npm start` en local arrancaba contra la base de producción** | Escribiendo el documento de entornos. El error era de la propia IA (ver la tabla siguiente) |
| **La contraseña del seed y datos personales de terceros en el historial de git** | Caracterizando el seed, y al mover los documentos históricos |

Los cuatro primeros eran fallos de dinero, y se corrigieron con pago real antes y después. La
lección de los tres últimos: **documentar es otra forma de revisar el código**. La suite probaba
lo que el código hacía, no lo que debía impedir.

## Los errores de la IA, y qué los detectó

Contarlos es el objetivo de este documento, no un gesto de humildad.

| # | Qué pasó | Qué lo detectó |
|---|---|---|
| 1 | Rompió **testing**, un entorno compartido, con la prueba del `search_path`, que debió hacer antes contra una base de usar y tirar | Un `db-whoami` de rutina justo después |
| 2 | Dio por buena una limpieza que **había fallado entera en silencio**: 20 llamadas a `psql` rechazadas por un parámetro de la URL, con los errores descartados | Medir el resultado en vez de fiarse del «hecho» |
| 3 | **Imprimió un secreto** al mostrar como contexto la línea anterior a la que buscaba | Releer su propia salida |
| 4 | Se dejó una rama fuera al reescribir el historial: enumeró las ramas de memoria en vez de listarlas | La verificación posterior, que encontró el secreto vivo en esa rama |
| 5 | Su detector de secretos solo veía 1 de 5 valores, y reportó un resultado basado en esa medición | Desconfiar de una cifra que no cuadraba |
| 6 | Propuso un cambio que **habría bajado producción de Node 24 a Node 22**, suponiendo el contenido de un panel que nunca había visto | **Ramón**, que lo paró antes de aplicarlo |
| 7 | Dio por buena una regla de refactor («estos dos filtros no se pueden unificar») deducida de leer el código | El test de integración que debía demostrarla, que demostró lo contrario |
| 8 | Escribió dos tests con supuestos falsos: que una ventana de duración cero no se solapa, y que `23.45 * 100` descuadra en coma flotante (da 2345 exacto) | La ejecución. Un test que falla puede estar diciendo que la especificación está mal |
| 9 | Diagnosticó dos veces mal un test intermitente: primero la hidratación, luego el refresco | Medir con 30 repeticiones por estado del código. La bisección señaló un solo fichero |
| 10 | **Borró parte de `node_modules`** al limpiar un worktree temporal con un enlace a la carpeta real | La propia IA, al revisar. Lo contó sin esperar a que se notara, restauró y lo dejó como regla |
| 11 | **Eligió `.env.production` como nombre** del fichero de producción, sin comprobar que Next lo carga solo al arrancar. Lo vio a medias en P5, protegió solo los tests y no avisó | Escribir la documentación de entornos, comprobando qué carga cada comando |
| 12 | En el borrador de la arquitectura afirmó tres cosas falsas: que Zustand no se usaba, que la web solo estaba en español y que en las previews no llega el webhook | Contrastar cada afirmación con el código antes de commitear |

**El patrón es el titular: los doce los detectó una comprobación posterior, nunca el
razonamiento previo.** El sexto, el único que habría tocado producción directamente, lo paró una
persona. Y el undécimo, el más cercano a producción después de ese, lo destapó el propio proceso
de documentar.

## Lo que se aprende

1. **El valor no está en generar código rápido, sino en los controles que se ponen antes de que
   el código toque algo real.** Las fases que más valieron casi no produjeron código: la prueba
   de humo, la auditoría, la puerta del pago.
2. **La verificación tiene que ser independiente del trabajo que verifica.** «Ya está hecho» no es
   un estado que se pueda observar: hay que medirlo. El error 2 es el caso puro.
3. **La IA propone con seguridad cosas que no ha comprobado.** La mitigación no es desconfiar de
   todo, sino **pedir los datos que no se pueden observar** antes de decidir sobre ellos, y
   contrastar cada afirmación con el código antes de escribirla.
4. **Los tests prueban lo que se les pide.** La suite no vio los fallos de roles ni el acceso por
   nº de pedido, porque nadie le había pedido que los buscara. Leer el código para explicarlo sí
   los vio.
5. **Una persona sigue siendo imprescindible** para lo que la IA no puede observar ni hacer: pagar
   con una tarjeta, abrir el panel de un proveedor, decidir qué quiere el negocio y parar una
   propuesta que suena bien.

## Lo que queda pendiente

Por honestidad, lo que este trabajo no ha resuelto:

- **Los riesgos abiertos de [`seguridad.md`](seguridad.md)**, R1 a R8. El más relevante es que la
  sesión del panel no se puede revocar. Están en Linear, pendientes de decisión.
- **El incidente del 17 de julio de 2026.** En la apertura de reservas de la final del Mundial, el
  pool de conexiones a la base se agotó durante diez minutos. La IA analizó 1850 registros de
  Vercel y propuso un plan con prioridades: sacar escrituras de las páginas públicas, cachear
  lecturas y ajustar el pool. **Ese plan no se ha aplicado.** La página del evento sigue
  escribiendo en la base al abrirse, y el pago sigue usando una transacción interactiva, que el
  pooler lleva mal. Un pico parecido hoy podría repetirlo.
- **La contraseña del seed y los datos de terceros en el historial**, que hay que resolver antes de
  publicar el repositorio.
