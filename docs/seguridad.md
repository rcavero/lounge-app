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

1. **`middleware.ts`**: sin sesión, `/admin` redirige al login.
2. **Las páginas del ADMIN** llaman a `redirectUnlessAdmin()`.
3. **Cada server action** exige `requireAuth()` o `requireAdmin()` como primera instrucción.
   `tests/integration/roles.test.ts` recorre las acciones del ADMIN con la sesión de un WORKER y
   con los guardias reales.

La sesión es una cookie cifrada con `iron-session`: `httpOnly`, `sameSite=lax`, `secure` en
producción y siete días de vida. Las contraseñas se guardan con bcrypt (coste 10). El login da el
mismo mensaje si el email no existe que si la contraseña es incorrecta, y bloquea una IP durante
15 minutos tras 5 fallos.

### La reserva del cliente

El cliente no tiene cuenta. Su reserva se abre con una **llave aleatoria** de 128 bits
(`accessToken`), que viaja en las URL de vuelta que se firman para Redsys. El nº de pedido solo
no basta, porque son los 12 últimos dígitos del reloj y se adivina. Sin la llave, la
confirmación da 404, la página de error no cancela nada y el ticket no se entrega. La comparación
es de tiempo constante.

Las reservas anteriores al 25 de septiembre de 2026 no tienen llave y se abren solo con el nº de
pedido, porque sus URL ya estaban repartidas. La retención de 90 días las borra.

### Los secretos

- **Ningún secreto está en el repositorio.** Los `.env*` están en `.gitignore`, y el CI no usa
  ninguno: su base es un contenedor efímero, Redsys usa el comercio de pruebas público, y
  `AUTH_SECRET` se genera en cada ejecución.
- **`AUTH_SECRET` y `CRON_SECRET` son distintos en testing y en producción.** La clave real de
  Redsys solo existe en Vercel, en el scope Production.
- **Los crons exigen `CRON_SECRET`.** Si la variable falta, responden 401: no quedan abiertos.

### Lo que viene de fuera

- **SQL**: todas las consultas pasan por Prisma, que parametriza. No hay SQL crudo con datos del
  usuario. El único `$queryRaw` está en los tests, sobre el catálogo de Postgres.
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
| 4 | **Alto.** El login no limitaba los intentos | **Cerrado a medias.** Hay límite por IP, pero en memoria (ver R2) |
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

## Riesgos conocidos y abiertos

Ninguno permite cobrar sin pagar ni entrar al panel sin credenciales. Están ordenados por
importancia y se siguen en Linear.

| | Riesgo | Por qué importa | Posible arreglo |
|---|---|---|---|
| **R1** | **La sesión no se puede revocar.** La cookie guarda el rol y dura siete días, y los guardias no vuelven a mirar la base. Borrar a un usuario o quitarle el rol de ADMIN no le afecta hasta que caduca su cookie. Tampoco cerrar sesión invalida una copia robada | Un empleado que deja el bar conserva el acceso hasta una semana | Que `getSessionData` compruebe en la base que el usuario existe y leer de ahí su rol, o guardar en la sesión una versión que se invalide al cambiarlo |
| **R2** | **El límite de intentos del login vive en la memoria del servidor.** En Vercel hay varias instancias a la vez y se reciclan, así que el límite es por instancia y se reinicia | Un ataque de fuerza bruta distribuido hace bastantes más de 5 intentos por cuarto de hora | Guardarlo en la base o en un almacén compartido. Las contraseñas del panel son la otra mitad de la defensa |
| **R3** | **Datos de terceros en el historial de git**: el email personal de la propietaria, el guion de una reunión de negocio con ella, y el email y la contraseña del seed en guías antiguas | Es un problema **solo si el repositorio se publica**. Borrarlos del último commit no basta | Publicar un repositorio nuevo sin historial, o reescribirlo. Está anotado en RCA-275 |
| **R4** | **La contraseña del seed** es conocida y está en el historial | Si alguna cuenta viva la usa, cualquiera que lea el repositorio entra al panel | RCA-275: comprobar antes de publicar que ninguna cuenta la usa |
| **R5** | **Sin cabeceras de seguridad propias**: no hay `Content-Security-Policy` ni `frame-ancestors` | El panel se podría incrustar en otra web (*clickjacking*). Vercel ya pone HSTS en sus dominios | Añadirlas en `next.config.ts`, probando antes que la pasarela y los PDF siguen funcionando |
| **R6** | **El login tarda distinto si el email existe**: solo entonces se calcula bcrypt | Midiendo tiempos se puede saber qué emails son del personal | Comparar siempre contra un hash ficticio |
| **R7** | **`initializeSeatsForEvent` es una server action sin guardia.** Solo la llama la página del evento, y su identificador no llega al navegador | Crea los 47 `SeatStatus` de un evento que no los tenga. No da acceso a nada, pero es un endpoint que no tendría que serlo | Moverla a `lib/`, como se hizo con confirmar y cancelar |
| **R8** | **Commits antiguos accesibles por su SHA en GitHub** después de reescribir el historial, hasta que pase el recolector de GitHub | Contenían el `AUTH_SECRET` viejo, ya rotado: no abren ninguna puerta | Pedir a GitHub la purga, o publicar un repositorio nuevo (ver R3) |

## Cómo se revisa un cambio

- **Toda server action nueva se protege a sí misma**, aunque su página ya esté protegida: es un
  endpoint. Si es del panel, se añade a `roles.test.ts`.
- **Lo que no deba llamar el navegador va en `lib/`**, nunca en un fichero `"use server"`.
- **Nada del navegador decide dinero ni permisos**: precios, estados o roles se leen de la base.
- **Un secreto nuevo** va en `.env.example` sin valor, en Vercel por scope, y nunca en un
  documento.
- **Un cambio en el camino del pago** pasa por un pago real en la preview, antes y después de
  desplegar.
