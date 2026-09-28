# Seguridad

La aplicación cobra con tarjeta, guarda el nombre que da cada cliente y tiene un panel con el que
se pueden borrar eventos con sus reservas pagadas. Este documento recoge qué se protege, frente a
quién, cómo, y **qué riesgos se conocen y siguen abiertos**.

## Qué se protege

| Activo | Qué pasaría si se rompe |
|---|---|
| **El cobro** | Una reserva confirmada sin pagar, un importe distinto del que toca, o un asiento vendido dos veces |
| **El panel** | Alguien crea, edita o borra eventos y reservas, o descarga los informes económicos |
| **La reserva de cada cliente** | Un tercero ve su ticket, o cancela su reserva mientras paga |
| **Los secretos** | Con la clave de Redsys se pueden forjar notificaciones de pago. Con `AUTH_SECRET`, cookies de administrador |

La aplicación **no guarda datos de tarjeta**: el cliente paga en la página de Redsys, y aquí solo
llega el resultado firmado. Del cliente se guarda el nombre o alias que escribe al reservar. La
app no pide email ni teléfono.

## Frente a quién

| Actor | Qué puede hacer | Qué se le impide |
|---|---|---|
| **Cualquiera en internet** | Ver los eventos, reservar y pagar | Confirmar sin pagar, elegir el precio, ver o cancelar reservas ajenas, entrar al panel |
| **Un cliente curioso** | Manipular las llamadas del navegador a las server actions | Todo lo anterior: el servidor no se fía de nada de lo que llega del navegador |
| **Un WORKER** | Ver reservas y bloquear asientos | Crear, editar o borrar eventos, mover el plano, ver informes, gestionar usuarios o marcar devoluciones |
| **Quien imite a Redsys** | Enviar peticiones al webhook | Confirmar nada: sin la firma HMAC válida, la notificación se descarta |

## Cómo

### El cobro

- **El importe lo calcula el servidor**, con los precios de la base de datos y en céntimos
  enteros. Del navegador solo llegan el evento, los asientos y el nombre. Va firmado hacia
  Redsys, así que tampoco se puede cambiar por el camino.
- **Solo la notificación firmada de Redsys confirma un pago en producción.** El webhook verifica
  la firma HMAC-SHA256 con la clave del comercio antes de tocar nada. La página de confirmación,
  en producción, solo espera. La guarda está dentro de `confirmReservationByOrderId`, no en la
  página.
- **El recibo no lo puede escribir el navegador.** `receipt.ts`, `settle-payment.ts`,
  `apply-payment-outcome.ts` y `return-pages.ts` son módulos planos, no server actions.
  Exportadas desde un fichero `"use server"`, cualquiera podría llamarlas y confirmar una
  reserva o escribir un código de autorización inventado.
- **`payments/actions` solo exporta dos funciones** (`initializePayment` y
  `getReservationByOrderId`), y un test lo comprueba.
- **Dos clientes no se llevan el mismo asiento.** Apartar los asientos es una sola transacción
  que solo cuenta los que siguen libres. Si falta uno, se deshace entera.
- **`redsys.ts` lanza al importarse si faltan sus credenciales.** Así un despliegue mal
  configurado falla al desplegar, no cuando un cliente paga. Antes había una clave de pruebas
  escrita en el código como valor por defecto.

### El panel

Tres capas. Solo la última es imprescindible, porque es la única que no se puede esquivar
llamando directamente a una acción:

1. **`middleware.ts`**: sin cookie de sesión, `/admin` redirige al login. Solo ve la cookie; el
   layout del panel la comprueba contra la base y, si ya no vale, también manda al login.
2. **Las páginas del ADMIN** llaman a `redirectUnlessAdmin()`.
3. **Cada server action** exige `requireAuth()` o `requireAdmin()` como primera instrucción. Sin
   sesión, los dos mandan al login con `redirect`. No lanzan un error, porque en una navegación
   con `<Link>` el layout no se vuelve a pintar y el usuario vería la pantalla de error de Next.
   Con sesión pero sin rol, `requireAdmin` lanza `Forbidden`.
   `tests/integration/roles.test.ts` recorre las acciones del ADMIN con la sesión de un WORKER y
   con los guardias reales.

La sesión es una cookie cifrada con `iron-session`: `httpOnly`, `sameSite=lax`, `secure` en
producción y siete días de vida. **No es la verdad durante esos siete días**: `getSessionData`
(`auth/lib/session-data.ts`) relee al usuario en la base en cada petición del panel. Si lo han
borrado, o su contraseña ya no es la de cuando entró, no hay sesión, y el rol se lee siempre de
la base. Para lo de la contraseña, la cookie guarda una huella del hash, no el hash. Como el cambio
es instantáneo, el panel no deja bajar de rol ni borrar al último ADMIN.

**Entre administradores** (P12), la regla la decide una sola función, `users/domain/permissions.ts`,
que usan la página y las acciones:

- La ficha de otro ADMIN es de solo lectura. Si se le pudiera quitar el rol, se le podría degradar
  y luego cambiarle la contraseña o borrarlo.
- Tres acciones piden otra vez la contraseña del ADMIN conectado: cambiar cualquier contraseña,
  dar el rol de ADMIN y borrarse a sí mismo. Así una sesión que se ha quedado abierta no basta.
  Esa comprobación tiene el mismo límite que el login (5 fallos, 15 minutos), con su propia clave
  por usuario.

Las contraseñas se guardan con bcrypt (coste 10). El login da el mismo mensaje, y tarda lo mismo,
si el email no existe que si la contraseña es incorrecta: en los dos casos calcula bcrypt. Tras 5
fallos bloquea la IP 15 minutos, con el contador en la tabla `LoginAttempt`, que comparten todas
las instancias de Vercel.

Todas las respuestas llevan `frame-ancestors 'none'` y `X-Frame-Options: DENY` (nadie puede
incrustar la web en otra página), `nosniff`, `Referrer-Policy` y una `Permissions-Policy`
restrictiva (`next.config.ts`). No hay CSP de scripts: ver R5' más abajo.

### La reserva del cliente

El cliente no tiene cuenta. Su reserva se abre con una **llave aleatoria** de 128 bits
(`accessToken`), que viaja en las URL de vuelta que se firman para Redsys. El nº de pedido solo
no basta, porque son los 12 últimos dígitos del reloj y se adivina. Sin la llave, la
confirmación da 404, la página de error no cancela nada y el ticket no se entrega. La comparación
es de tiempo constante.

Las reservas anteriores al 25 de septiembre de 2026 no tienen llave y se abren solo con el nº de
pedido, porque sus URL ya estaban repartidas. La retención de 90 días las borra.

### Los secretos

- **Ningún secreto ni dato privado está en el árbol del repositorio.** Los `.env*` están en
  `.gitignore`, y el CI no usa ninguno: su base es un contenedor efímero, Redsys usa el comercio de
  pruebas público, y `AUTH_SECRET` se genera en cada ejecución. El seed no lleva credenciales: el
  primer ADMIN sale de `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.
- **`tests/unit/no-private-data.test.ts` impide que vuelvan.** Falla si un fichero lleva un correo
  fuera de una lista blanca, o uno de los datos retirados en septiembre de 2026: el FUC de
  producción, el correo de la propietaria, claves y refs de Supabase. Los compara por huella
  SHA-256, así que el test no los contiene.
- **`AUTH_SECRET` y `CRON_SECRET` son distintos en testing y en producción.** La clave real de
  Redsys solo existe en Vercel, en el scope Production.
- **Los crons exigen `CRON_SECRET`.** Si la variable falta, responden 401: no quedan abiertos.

### Lo que viene de fuera

- **SQL**: todas las consultas pasan por Prisma, que parametriza. El único SQL crudo de la app es
  el contador del login (`lib/rate-limit.ts`), con la plantilla etiquetada `$executeRaw`, que
  también parametriza: la IP no se concatena nunca.
- **HTML**: React escapa todo lo que pinta, y no hay `dangerouslySetInnerHTML`.
- **El nombre del cliente** se normaliza y se valida en el servidor
  (`payments/lib/customer-name.ts`): solo Latin-1, sin caracteres de control ni marcas
  bidireccionales, y 24 caracteres como mucho. No es por inyección, que ya cubren Prisma y
  React. Es porque el PDF no sabe pintar otra cosa, y porque las marcas bidireccionales permiten
  que un nombre se lea distinto de como está guardado.
- **La ruta de vuelta de Redsys** solo anota el recibo si la notificación está firmada **y** su nº
  de pedido coincide con el de la URL, que controla quien navega.

## La auditoría de abril de 2026

Se hizo el 22 de abril ([`historico/AUDITORIA_SEGURIDAD_ABRIL_2026.md`](historico/AUDITORIA_SEGURIDAD_ABRIL_2026.md)).
Este es el estado de cada hallazgo en septiembre:

| # | Hallazgo | Estado |
|---|---|---|
| 1 | **Crítico.** La página de confirmación confirmaba la reserva al visitarla: se podía reservar sin pagar | **Cerrado.** En producción solo confirma el webhook, y la guarda vive dentro de la función (RCA-285) |
| 2 | **Crítico.** El precio llegaba del navegador | **Cerrado.** Se calcula en el servidor, en céntimos, con los precios de la base |
| 3 | **Alto.** Sin `CRON_SECRET` configurado, los crons quedaban abiertos | **Cerrado.** Sin la variable, 401 |
| 4 | **Alto.** El login no limitaba los intentos | **Cerrado.** Límite por IP guardado en la base desde septiembre (R2) |
| 5 | **Alto.** Server actions del panel sin comprobar la sesión | **Cerrado**, y reforzado en septiembre: además del login, ahora se comprueba el rol (RCA-285) |
| 6 | **Medio.** Clave de pruebas de Redsys como valor por defecto en el código | **Cerrado.** Sin credenciales, la app no arranca |

## Lo que se encontró y cerró en septiembre de 2026

| Qué | Cómo se cerró |
|---|---|
| El `AUTH_SECRET` de producción estaba en texto plano en dos documentos, y era el mismo en testing | Borrado de todo el historial de git y **rotado**, con valores distintos por entorno |
| Una copia SQLite con correos y hashes de contraseña estaba versionada | Purgada del historial |
| Dos clientes simultáneos podían comprar el mismo asiento | Apartado atómico en la transacción (RCA-175) |
| Un pago que llegaba con la reserva caducada se cobraba sin asientos | Rescate de los asientos o devolución avisada en el panel (RCA-276) |
| La ventana de reserva solo la comprobaba la portada | Comprobación en el servidor (RCA-277) |
| El rol WORKER solo se limitaba en la interfaz | `requireAdmin` en 13 acciones y redirección en 8 páginas (RCA-285) |
| Con el nº de pedido se veía o cancelaba una reserva ajena | Llave aleatoria por reserva (RCA-285) |
| Un `npm start` en local arrancaba contra la base de producción | El fichero pasó a llamarse `.env.prod` (ver [`entornos.md`](entornos.md)) |
| **R1** · La sesión no se podía revocar: la cookie guardaba el rol y los guardias no miraban la base | La sesión se comprueba contra la base en cada petición, con una huella de la contraseña (RCA-286) |
| **R2** · El límite de intentos del login vivía en la memoria de cada instancia | Tabla `LoginAttempt`, con una suma atómica (RCA-286) |
| **R4** · La contraseña del seed estaba en el código y la usaba una cuenta de testing | Cambiada en testing; ninguna cuenta de producción la usaba (comprobado en solo lectura). El seed ya no lleva credenciales (RCA-275) |
| **R5** · Sin cabeceras de seguridad propias: el panel se podía incrustar en otra web | `frame-ancestors 'none'`, `X-Frame-Options` y tres cabeceras más (RCA-286) |
| **R6** · El login tardaba menos si el email no existía | Siempre se calcula bcrypt (RCA-286) |
| **R7** · `initializeSeatsForEvent` era una server action sin guardia | Pasó a `seating/lib/`, fuera de `"use server"` (RCA-286) |

## Riesgos conocidos y abiertos

Ninguno permite cobrar sin pagar ni entrar al panel sin credenciales. R1, R2 y R4 a R7 se cerraron
en septiembre (tabla de arriba). Lo que queda:

| | Riesgo | Por qué importa | Estado |
|---|---|---|---|
| **R1'** | **Cerrar sesión no invalida una copia robada de la cookie.** La sesión cae si se borra al usuario o se le cambia la contraseña, no al pulsar «Salir» | Quien robe la cookie (hace falta acceso al navegador: es `httpOnly`) la puede usar hasta siete días | Aceptado. Arreglo si hiciera falta: una versión de sesión en la base que «Salir» incremente, con una migración. Mientras, cambiar la contraseña corta todas las sesiones de esa cuenta |
| **R3** | **Datos de terceros en commits antiguos**: el correo de la propietaria, el guion de una reunión con ella, el FUC de producción y credenciales ya inservibles | Solo importa si el repositorio se publica. **Ya no están en el árbol actual** y un test impide que vuelvan | **Aceptado por el propietario del repo**: el historial no se reescribe |
| **R5'** | **Sin CSP de scripts** | Una CSP limitaría el daño de un XSS. Hoy no hay HTML de terceros ni `dangerouslySetInnerHTML` | Aceptado: Next inyecta scripts en línea y exigiría nonces, que vuelven dinámicas todas las páginas |
| **R8** | **Commits antiguos accesibles por su SHA en GitHub** tras la reescritura del 22 de septiembre, hasta que pase su recolector | Contenían el `AUTH_SECRET` viejo, ya rotado, y una copia SQLite de desarrollo | Aceptado, como R3. Si se quisiera cerrar, se pide la purga a GitHub Support, sin tocar el repo |

## Cómo se revisa un cambio

- **Toda server action nueva se protege a sí misma**, aunque su página ya esté protegida: es un
  endpoint. Si es del panel, se añade a `roles.test.ts`.
- **Lo que no deba llamar el navegador va en `lib/`**, nunca en un fichero `"use server"`.
- **Nada del navegador decide dinero ni permisos**: precios, estados o roles se leen de la base.
- **Un secreto nuevo** va en `.env.example` sin valor, en Vercel por scope, y nunca en un
  documento.
- **Un cambio en el camino del pago** pasa por un pago real en la preview, antes y después de
  desplegar.
