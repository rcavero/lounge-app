# Reunión — mejoras v2 de la app · The Lounge Beerhouse

**Fecha:** 19 de agosto de 2026 · **Asistentes:** Susana (propietaria) y Ramón (desarrollo) · **Duración estimada:** 45 minutos

**Objetivo:** decidir cuáles de las cinco mejoras entran en la siguiente versión y en qué orden. Todo lo que se apruebe se implementa primero en la web de pruebas, se usa unos días con clientes reales de forma controlada y solo después pasa a la web de verdad.

---

## Resumen de los cinco puntos

| Punto | Qué resuelve | Esfuerzo |
|---|---|---|
| 1. Nombre o alias del cliente | La camarera puede localizar una reserva sin ticket | Bajo |
| 2. Llamada al banco | El cliente vuelve solo a nuestra web y descarga el ticket | Ninguno (llamada) |
| 3. Email al cliente | El ticket llega siempre, aunque cierre la pestaña | Alto |
| 4. Nombres de asientos + editor | El plano se corresponde con el local y lo gestionas tú | Alto |
| 5. Nuevo proveedor de partidos | De 12 a 17 competiciones y 11 deportes más | Ya hecho |

---

## 1. Nombre o alias del cliente en la reserva

### Qué es

Hoy, cuando alguien reserva y paga, **la reserva se guarda sin nombre**: en el panel aparecen todas como "Cliente". Si el cliente llega al bar sin el ticket, la camarera no tiene ninguna forma de buscarlo salvo ir mirando reserva por reserva.

La propuesta: antes de ir a la pasarela de pago aparece un cuadro pidiendo un nombre o alias. Ese nombre se imprime en el ticket y aparece en el listado y en el detalle de la reserva del panel. Con eso, **el ticket deja de ser imprescindible**: el cliente dice su nombre y la camarera lo encuentra.

### Qué decides tú

- **¿Obligatorio u opcional?** Mi recomendación: obligatorio. Si es opcional, la mitad lo dejará en blanco y volvemos al problema de hoy.
- **¿Nombre real o vale un alias?** Mi recomendación: que valga cualquier cosa que el cliente reconozca ("Susana", "Peña Los Amigos"). Cuanto menos dato personal pidamos, mejor.
- **¿El nombre aparece también en el informe mensual en PDF?** Mi recomendación: no. Ese informe es un documento contable de columnas fijas y meterlo obliga a rehacer la maquetación entera.

### Qué necesito de ti

- Los **textos exactos** que verá el cliente en ese cuadro, en castellano y en inglés: el título, la ayuda debajo del campo y el botón. Si prefieres, te propongo yo unos y tú los corriges.
- Que las camareras lo prueben unos días en la web de pruebas y me digan si el nombre les sirve de verdad para localizar reservas o si necesitan algo más.
- **Nada más:** no hace falta ninguna cuenta, ninguna contraseña ni ningún servicio nuevo.

---

## 2. Llamada al banco para quitar la pantalla final de la pasarela

### Qué es

Este es **el problema de raíz**, y explica todos los tickets que no llegan.

Cuando el cliente paga, Redsys le muestra una pantalla de "Operación autorizada" con un botón "Continuar". Ese botón es el que le devuelve a nuestra web, y **es nuestra web la que descarga el ticket**. Mucha gente cierra la pestaña ahí mismo, en cuanto ve que el pago ha ido bien: la reserva queda cobrada y confirmada correctamente, pero el cliente se queda sin ticket.

Conviene que quede claro, porque me lo han preguntado varias veces: **mientras el cliente está en esa pantalla del banco no hay absolutamente nada que podamos programar**. Es una web del banco, no nuestra. No es cuestión de esfuerzo: no se puede.

Lo que sí se puede es pedirle al banco que configure el terminal para que **la vuelta a nuestra web sea automática**, sin que el cliente tenga que pulsar nada. Muchos terminales lo permiten. Si nos lo activan, el problema desaparece de golpe para todos los clientes, sin tocar una línea de código y sin coste.

### Qué decides tú

- **¿Llamas tú o me autorizas a llamar en tu nombre?** El banco solo trata con el titular del comercio, que eres tú. Puedo prepararte exactamente qué pedir, o acompañarte en la llamada.
- **¿Aprovechamos para pedir acceso de administración al portal del comercio?** Si nos lo dan, cambios como este los podemos hacer nosotros sin depender de una llamada cada vez.

### Qué necesito de ti

- Que hagas la llamada al gestor de CaixaBank con estos datos delante (te los paso por escrito): **comercio The Lounge Beerhouse, FUC 352464580, terminal 1**.
- Que preguntes literalmente esto: *"¿se puede configurar en el Módulo de Administración que el terminal redirija automáticamente a la web del comercio al terminar el pago, sin que el cliente tenga que pulsar Continuar?"*.
- Que me digas qué te contestan, sea que sí o que no.

**Este punto va el primero de todos: no cuesta nada, no depende de desarrollo y no bloquea ninguna otra cosa.**

---

## 3. Email al cliente con el ticket

### Qué es

La alternativa "completa" al punto 1: cuando el pago se confirma, **nuestro servidor genera el ticket y lo envía por correo**, independientemente de lo que haga el cliente con su navegador. Es el único canal que llega al 100 % de los clientes, y sirve además a quien pierde el PDF o cambia de móvil.

Es también, con diferencia, **el punto más caro de los cinco**, y quiero ser transparente sobre por qué:

- **Técnicamente:** hay que cambiar la base de datos, pedirle el email al cliente antes de pagar, montar un sistema de envío con reintentos para los correos que fallan, diseñar la plantilla, y añadir en el panel un aviso de "este email no salió" con un botón de reenviar. Es varias veces el trabajo del punto 1.
- **En mantenimiento:** hace falta una cuenta de correo del bar viva, y alguien pendiente de que los correos no acaben en spam.
- **En protección de datos:** aquí está lo importante. Un alias es prácticamente inocuo; **una dirección de correo es un dato personal identificable**. Guardarla obliga a tener publicada una política de privacidad en la web, a informar al cliente en el momento exacto de pedírsela, a firmar el contrato correspondiente con el proveedor de correo, a fijar cuánto tiempo se conservan los datos y a ofrecer un canal para que un cliente pida ver o borrar los suyos. Y esa lista de correos **no se puede usar para promociones** sin pedir un consentimiento aparte y separado.

Mi valoración honesta: **los puntos 1 y 2 resuelven el problema operativo real —que la camarera sepa quién es cada reserva— sin nada de todo esto**. El email aporta cosas de más, pero no es lo que hoy está doliendo.

### Qué decides tú

- **Hacerlo ahora, aplazarlo o descartarlo.** Mi recomendación: **aplazarlo**. Hacemos 1 y 2, lo vemos funcionando unas semanas, y si aun así sigue habiendo clientes perdidos, lo retomamos. El trabajo del punto 1 no se tira: el cuadro ya estaría hecho y solo habría que añadirle el campo del email.
- Si decides hacerlo, decide también si quieres **recibir copia oculta de cada reserva** en un correo del bar. Es gratis y os avisa en tiempo real sin tener que abrir el panel.

### Qué necesito de ti — solo si se aprueba

- **Qué cuenta de correo se usa** para enviar (el Gmail del bar o una dirección con vuestro dominio) y quién la administra.
- Acceso a esa cuenta para configurarla: en concreto, una **contraseña de aplicación**, que exige tener activada la verificación en dos pasos. No necesito tu contraseña personal.
- Un **correo de contacto** al que puedan escribir los clientes para pedir sus datos o su borrado.
- Que **tu gestoría revise el aviso de privacidad** de la web. Esto no lo puedo redactar yo: es asesoramiento legal, y quien responde ante la Agencia de Protección de Datos es el negocio.

---

## 4. Nombres de los asientos y editor completo

### Qué es

Detectaste que **los nombres de los asientos no se corresponden con el local**: vienen de la carga inicial y nunca se revisaron contra el sitio real.

Hoy el editor del panel **solo permite arrastrar asientos** para colocarlos en el plano. No se puede renombrar, ni crear, ni eliminar: para aplicar tu listado nuevo tengo que entrar a la base de datos a mano, uno por uno.

La propuesta es aprovechar ese arreglo obligatorio para convertir el editor en una herramienta completa: tocas un asiento y puedes **renombrarlo o eliminarlo**, y hay un botón para **crear** asientos nuevos. A partir de ahí mantienes el plano tú sola, sin depender de mí.

Algo que hay que decir sin adornos: **al hacer este trabajo se arreglan de paso tres fallos que ya están hoy en la web de verdad** y que tienen que ver con dinero — situaciones raras pero posibles en las que se puede cobrar por un asiento que no queda reservado, o en las que dos clientes reservando a la vez el mismo asiento dejan a uno de los dos pagado y sin sitio asignado. No son consecuencia del cambio nuevo: están ahí desde el principio. **Si solo se aprobara una cosa de esta reunión, sería esta.**

### Qué decides tú

- **¿Aplicas tú el listado nuevo desde el editor, o lo hago yo de una vez?** Con el editor son unos minutos por asiento; hacerlo yo es más rápido pero necesito el listado cerrado y sin dudas.
- **¿Cambia el número de asientos?** Si el local ya no tiene las mismas mesas, es el momento de añadir o quitar.
- **¿Se mantienen los carteles TV1 / TV2 / PROYECTOR del plano?** Al cliente le indican qué pantalla mira cada zona. Se pueden quitar, pero es un cambio aparte.

### Qué necesito de ti

- **El listado definitivo**, idealmente como una foto o croquis del local más una tabla de "nombre actual → nombre nuevo". Con estas reglas, que son técnicas pero importantes:
- **Máximo 10 caracteres por nombre.** No es un capricho: es lo que cabe en el ticket, que se imprime en papel de 80 mm. Con 12 caracteres el texto se sale del papel.
- **Solo letras, números y los signos guion bajo, guion, barra y punto.** Sin espacios, sin acentos, sin eñes ni símbolos de moneda.
- **Los nombres no pueden repetirse ni siquiera cambiando mayúsculas:** "M12" y "m12" cuentan como el mismo, porque a simple vista en un ticket son indistinguibles y acabaría alguien sentado donde no es.
- **Una ventana de tiempo sin partidos publicados** para hacer el cambio. Por seguridad, el sistema no deja tocar la estructura de asientos mientras haya eventos activos con reservas en marcha. Hay que buscar un hueco y acordarlo.

Un aviso para que no te sorprenda: al renombrar un asiento, **los partidos ya jugados pasan a mostrar el nombre nuevo** en el panel, mientras que el ticket que el cliente descargó en su día sigue diciendo el nombre viejo. Es asumible —los eventos antiguos se borran solos a los 90 días— pero conviene saberlo.

---

## 5. Nuevo proveedor de partidos (ESPN) a producción

### Qué es

El sistema que rellena solo las sugerencias de partidos ya está migrado y **funcionando en la web de pruebas**. Lo que queda es decidir si se publica en la web de verdad.

Qué gana:

- **De 12 a 17 competiciones.** Las nuevas: Europa League, Conference League, Segunda División, Copa del Rey, Supercopa de España, Copa América y Nations League.
- **11 deportes más** que se cargan a mano con su icono: baloncesto, rugby, tenis, MotoGP, Fórmula 1, billar, dardos, hockey, ciclismo, boxeo y "otros".
- **Los escudos ya se sirven desde nuestro propio servidor**, no desde fuera: la web carga más rápido y no depende de nadie para pintar un escudo.
- **Coste: cero.** No hay cuota ni suscripción.

Y el riesgo, dicho con claridad: **es una fuente pública sin contrato ni garantía de servicio**. Si algún día dejara de responder, lo que pasaría es que **dejarían de aparecer las sugerencias automáticas de partidos**. Los eventos ya creados, las reservas y los pagos **no se verían afectados en absoluto**, y se podrían seguir creando eventos a mano como hasta ahora. El plan B, si eso ocurriera, es un servicio de pago de unos **9 dólares al mes** que ya está identificado y que sería cuestión de cambiarlo en un rato.

### Qué decides tú

- **¿Se publica ya en producción** asumiendo que la fuente es gratuita y sin contrato?
- **¿Apruebas de antemano esos ~9 $/mes** como plan B, para que si algún día falla no haya que esperar a una reunión para arreglarlo?

### Qué necesito de ti

- Que **revises la lista de competiciones y deportes** y me digas si falta algo que se emita en el local. Pienso en NBA, NFL, UFC o fútbol femenino, por ejemplo.
- Que **eches un vistazo a la web de pruebas** y confirmes que los nombres de equipos y los escudos se ven correctos.

---

## Cómo se despliega todo

Nada va directo a la web de verdad. El proceso es siempre el mismo:

1. Se implementa y se prueba en una **web de pruebas** idéntica a la real, con pagos simulados.
2. Se deja funcionando **unos días**, y tú y las camareras la usáis como si fuera la buena.
3. Solo cuando todo está confirmado, se publica en la web real.

Te paso la dirección de la web de pruebas para que puedas mirarla cuando quieras, desde el móvil.

---

## Orden que propongo

| Fase | Qué | Por qué va aquí |
|---|---|---|
| 1 | Llamada al banco | Coste cero, lo haces tú, no bloquea nada y ataca la causa raíz |
| 2 | Proveedor de partidos a producción | Ya está hecho; solo falta validarlo y publicarlo |
| 3 | Nombre del cliente | Rápido y resuelve el problema del día a día en el local |
| 4 | Asientos: arreglos internos y luego el editor | Lo más largo, y lo que arregla los fallos de cobro |
| 5 | Email al cliente | Solo si tras unas semanas 1 + 3 no han bastado |

---

## Para cerrar la reunión

**Lo que me llevo yo:**

- Los puntos aprobados y en qué orden.
- Los textos del cuadro de nombre, para dejarlos listos.
- La lista de competiciones o deportes que falten.

**Lo que te llevas tú:**

- Llamar al banco con el FUC y el terminal que te paso por escrito.
- Preparar el listado definitivo de nombres de asientos con las reglas de arriba.
- Buscar una fecha sin partidos publicados para hacer el cambio de nombres.
- Si se aprueba el email: hablar con tu gestoría sobre la política de privacidad.

---
---

# NOTAS INTERNAS — NO ENVIAR ESTA PARTE

---

## Objeciones previstas y respuesta preparada

**"¿Por qué no descargamos el ticket antes de que pulse Continuar?"**
Porque en ese momento el cliente está en un dominio del banco y **no hay ni una sola línea de código nuestro ejecutándose en esa pestaña**. No es una limitación de esfuerzo ni de presupuesto: técnicamente no existe la posibilidad. Las únicas salidas son que el banco quite esa pantalla (punto 2) o que el ticket salga por otro canal (punto 3). Si insiste, la tercera vía descartada es abrir el pago en pestaña nueva y sondear desde la nuestra: se descartó porque los navegadores dentro de Instagram y Facebook bloquean la apertura de pestañas y iOS congela las pestañas de fondo.

**"¿Por qué no hacemos el email y ya está?"**
Coste, mantenimiento y RGPD. Y sobre todo: el email garantiza que el ticket llegue, mientras que el nombre hace que **el ticket deje de hacer falta**. El problema operativo lo resuelven los dos, uno por una décima parte del trabajo. Recalcar que son acumulativos y que el punto 1 no se tira si luego se hace el 3.

**"¿Por qué no puedo cambiar los asientos cuando quiera?"**
Porque el bloqueo es global: si hay cualquier evento futuro cargado, no se puede tocar la estructura. Es la opción segura. Se puede relajar en una v3 para que solo bloquee el asiento concreto que tenga reservas, pero no ahora — no merece la pena la complejidad hasta ver si molesta en uso real.

**"¿Esto no lo teníamos ya?"**
Cuidado con esta: el ticket con QR y la autodescarga sí existen. Lo que no existe es que el ticket llegue si el cliente no vuelve, ni que la reserva tenga nombre.

## Detalle técnico por punto

| Punto | Esfuerzo / riesgo | Migración de BD | Plan de referencia |
|---|---|---|---|
| 1. Nombre del cliente | Bajo / muy bajo | **No** — `customerName` ya existe y se escribe | `PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md` |
| 2. Banco | Nulo / nulo | No | Paso 0 del mismo plan |
| 3. Email | Alto / medio | Sí — 4 columnas aditivas | `PLAN_IMPLEMENTACION_MAIL_CLIENTE.md` |
| 4. Asientos | Alto / medio-alto | Sí — `deletedAt` + backfill | `PLAN_EDITOR_ASIENTOS_V2.md` |
| 5. ESPN | Ya implementado / bajo-medio | No | `MIGRACION_API_FUTBOL.md` |

Notas que no van en la Parte 1:

- El punto 4 se despliega en dos PR: el primero es puro saneamiento invisible (bugs T5/T6/T7 + migración) y es desplegable solo; el segundo es el CRUD y la UI. **El orden migración-antes-que-código es crítico** o los planos aparecen incompletos para los clientes.
- El punto 5 tiene dos pendientes técnicos antes del merge a `main`: el soak del cron (Vercel no ejecuta crons en Preview, solo en Production) y ejecutar `scripts/download-crests.ts` una vez en producción para reenlazar los escudos locales.
- El punto 3 empieza por un spike de jsPDF en Node antes de escribir nada más; si fallara, el sustituto es `pdf-lib`.
- Recordatorio propio: `.env` apunta a **producción**. Antes de cualquier script que escriba, cargar `.env.testing` y confirmar con `scripts/db-whoami.ts`.

## Credenciales y accesos a pedir

| Qué | Para qué | Cuándo |
|---|---|---|
| Acceso al Módulo de Administración del portal del comercio | Configurar la vuelta automática sin depender de una llamada cada vez | Punto 2, si delega la gestión |
| Cuenta de correo del bar + contraseña de aplicación (exige 2FA) | Enviar los tickets por email | **Solo si se aprueba el punto 3** |
| Correo de contacto para derechos de los clientes | Obligación RGPD | Solo si se aprueba el punto 3 |
| Nada | Puntos 1, 4 y 5 | — |

**No pedir ni aceptar por correo o WhatsApp la clave SHA-256 de Redsys.** Ya está guardada en Vercel y no hay ningún motivo para volver a moverla.

## Pendientes heredados que conviene sacar hoy

- **Devolución del cargo de 10 €** de la prueba con tarjeta real de mayo. Sigue sin devolverse; se hace desde el portal del comercio.
- Los arreglos de la saturación de base de datos del **17 de julio** (apertura del Mundial) están sin confirmar como aplicados. Si se aprueba el punto 4, parte de ese trabajo entra por el camino.
- **La sesión del panel de administración no caduca nunca.** Es un riesgo real si alguien deja el móvil abierto en la barra. Merece mencionarlo aunque no esté en la agenda.
- **No hay ninguna suite de tests automáticos.** Cada despliegue depende de pruebas manuales. No pelearlo hoy, pero dejarlo dicho para futuras versiones.

## Lo que NO hay que prometer hoy

- **Fechas concretas** de nada.
- **Que la vuelta automática de Redsys sea posible.** Depende del banco. Decir "muchos terminales lo permiten", nunca "se puede".
- **Que ESPN vaya a seguir funcionando.** Es una fuente sin contrato; el compromiso es el plan B, no la disponibilidad.
- **Que el renombrado no afecte al histórico.** Sí lo afecta.

## Checklist de salida

- Decisión anotada punto por punto, incluidos los "no" y los "más adelante".
- Confirmado quién llama al banco.
- Acordada la ventana sin partidos publicados para el renombrado.
- Recibido —o con fecha de entrega— el listado de asientos y los textos del cuadro de nombre.
- Actualizar los tres planes del repo con lo decidido, antes de que se olvide.
