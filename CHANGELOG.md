# Changelog

Historia del proyecto, sacada del `git log` y agrupada por mes. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), con dos apartados propios, **Tests y
calidad** y **Documentación**. La aplicación no publica versiones: está en producción y cada
cambio llega a `main` cuando se ha probado en `testing`.

**Del 21 de septiembre al 1 de octubre de 2026 hubo dos historias.** `main` era producción y
`academic` la entrega del máster. El 1 de octubre `academic` se fusionó con `testing` y con
`main`, y desde entonces las tres ramas van juntas.

## Octubre de 2026

### Cambiado
- **La entrega del máster llega a producción** (1 de octubre). Es todo lo de septiembre que
  estaba solo en `academic`. Producción despliega el mismo commit que se probó en `testing`.
  - Antes del código se aplicaron dos migraciones aditivas: la llave de cada reserva y la tabla
    del límite de intentos del login.
  - Todo el personal vuelve a iniciar sesión una vez.

### Documentación
- El plan de la fusión, con sus riesgos, el orden de los pasos y el rollback, en
  `docs/historico/PLAN_FUSION_PRODUCCION.md`.

## Septiembre de 2026

### En `academic` (entrega del máster), en producción desde el 1 de octubre

#### Seguridad
- Usuarios del panel (P12):
  - la ficha de otro ADMIN es de solo lectura;
  - cambiar cualquier contraseña, dar el rol de ADMIN y borrarse a sí mismo piden la contraseña
    del ADMIN conectado;
  - el último ADMIN no se puede bajar de rol ni borrar;
  - la contraseña nueva se escribe dos veces y no puede pasar de 72 bytes, el límite de bcrypt;
  - las acciones de usuarios entran en el test de roles.
- La sesión del panel se comprueba contra la base en cada petición. Borrar a un usuario, quitarle
  el rol o cambiarle la contraseña le cierra la sesión al instante, sin esperar los 7 días de la
  cookie. El panel no deja quitarle el rol al último ADMIN ni borrarse a uno mismo. (RCA-286)
- El límite de intentos del login se guarda en la base: en memoria era por instancia de Vercel y
  se esquivaba. El login tarda lo mismo exista o no el email. (RCA-286)
- Cabeceras de seguridad en todas las respuestas: la web no se puede incrustar en otra página.
  (RCA-286)
- `initializeSeatsForEvent` deja de ser una server action. (RCA-286)
- El seed ya no lleva credenciales: el primer ADMIN sale de variables de entorno, y se crea como
  ADMIN, no como WORKER. (RCA-275)
- Fuera del árbol del repositorio: el correo de la propietaria, el guion de una reunión con ella, el
  FUC de producción, claves y contraseñas de las guías antiguas. Un test impide que vuelvan.
  (RCA-275)
- El rol WORKER se comprueba en el servidor. Antes, 13 acciones y 8 páginas del ADMIN solo
  pedían sesión: por URL, un WORKER podía borrar eventos con sus reservas pagadas. (RCA-285)
- Cada reserva lleva una llave aleatoria en las URL de vuelta del pago. Con el nº de pedido, que
  se adivina, ya no se ve el ticket de otro cliente ni se le cancela la reserva. (RCA-285)
- Confirmar y cancelar desde las páginas de vuelta dejan de ser server actions, y confirmar no hace
  nada en producción desde dentro de la propia función. (RCA-285)
- El fichero de entorno de producción pasa a llamarse `.env.prod`. Con `.env.production`, un
  `npm start` en local arrancaba contra la base de producción.
- Entornos aislados: un fichero `.env` por base de datos, con `DB_ENV`, y scripts que abortan si
  el entorno cargado no es el esperado. `.env` deja de apuntar a producción.

#### Cambiado
- Las pantallas de usuarios siguen el estilo del resto del panel:
  - la ficha tiene tres bloques, datos, contraseña y eliminar;
  - la contraseña se cambia con un botón y un modal, no con un campo vacío;
  - hay avisos (toast) al crear, guardar, cambiar la contraseña y eliminar.

#### Corregido
- **Un pago que llegaba con la reserva caducada se cobraba sin asientos.** Ahora recupera esos
  mismos asientos si siguen libres. Si no, la reserva queda para devolver, y el panel lo avisa.
  (RCA-276)
- La caducidad podía marcar como caducada una reserva recién pagada. Ahora solo caduca lo que
  sigue pendiente.
- El servidor aplica la ventana de 48 h a 4 h y el estado del evento. Antes solo lo hacía la
  portada, y por enlace directo se compraba un partido que empezaba en una hora. (RCA-277)
- Un asiento repetido en la petición se cobraba dos veces, y uno inexistente se cobraba sin
  apartar nada.
- Un deporte con un solo participante dejaba el título en «Velada vs ». (RCA-279)
- Los mapas de competiciones aceptaban claves del prototipo, como `constructor`. (RCA-274)
- Los botones de crear, editar y borrar evento se reactivaban antes de terminar la navegación, lo
  que permitía un doble envío.

#### Añadido
- Aviso de «Pagos a devolver» en el panel, con el botón «Ya está devuelto» para el ADMIN, y aviso
  al cliente de que su pago tardío se le devolverá.
- Pantallas de carga que imitan la página de destino, en todas las páginas, e indicador en la
  tarjeta pulsada.
- Botones con estado de carga.
- Animaciones de entrada que respetan «reducir movimiento».

#### Cambiado
- Las reglas de negocio salen de las server actions a módulos puros de `domain/`: importes, solape
  de eventos, caducidad, disponibilidad, meses de informe, títulos, ventana de reserva y resultado
  del pago.
- Node 24.21.0, alineado con producción.
- Borrado el código muerto: `createReservation`, cuatro componentes y `getSeatsByZone`.

#### Tests y calidad
- Vitest con tres proyectos (unitarios, componentes e integración contra Postgres real en Docker)
  y Playwright para el E2E: 373, 183 y 48 tests.
- Cobertura con umbrales sobre `domain/`, `lib/` y `config/`.
- CI en GitHub Actions con dos jobs, sin secretos.
- Prettier, ESLint y comprobación de tipos en el pre-commit. `npm run lint` a cero: los 533
  errores eran del cliente generado por Prisma.

#### Documentación
- `README`, `CONTRIBUTING`, `LICENSE`, este `CHANGELOG`, y `docs/` con arquitectura, modelo de
  datos, entornos, testing, seguridad, siete ADR y el desarrollo asistido por IA.
- Los planes y guías de cada etapa pasan a `docs/historico/`, sin editar.

### Directo en producción (`main`), antes de la fusión

#### Corregido
- **Dos clientes simultáneos podían comprar el mismo asiento.** Arreglo aplicado directamente en
  producción el 24 de septiembre, antes de fusionar `academic`. (RCA-175)
- ESPN dejó de aceptar rangos de fechas en su API de partidos, y las sugerencias se rompieron.

#### Añadido
- Escudos de los 33 equipos nuevos que trajo el primer sync de producción.
- Script de volcado completo de la base antes de migrar.

#### Seguridad
- **El `AUTH_SECRET` de producción estaba en dos documentos del repositorio desde marzo.** Se
  borró de todo el historial, junto con una copia de la base que incluía correos y hashes de
  contraseña, y se rotó con valores distintos por entorno.

## Agosto de 2026

### Añadido
- **Gastos de gestión por asiento**, no descontables en consumiciones, de 0 a 5 €. Los importes
  pasan a céntimos enteros, cada reserva congela el precio que pagó, y un `CHECK` en la base
  impide un total descuadrado.
- **Nombre o alias del cliente** al reservar, para que el personal encuentre la reserva sin
  ticket.
- **Recibo del pago** con el código de autorización y la fecha que manda Redsys, como exige
  CaixaBank. Las URL de vuelta pasan por una ruta que acepta GET y POST.
- **Nombres reales de los asientos** del local, con un script de renombrado en dos fases. La
  pantalla `PROYECTOR` pasa a llamarse `TV3`.
- La pasarela solo ofrece pago con tarjeta: sin Bizum.

### Cambiado
- **Proveedor de datos de fútbol: de football-data.org a la API pública de ESPN**, sin clave ni
  cuota. Pasa de 12 a 17 competiciones.
- Los escudos y emblemas se sirven desde `public/`, no desde los servidores de ESPN.

## Junio de 2026

### Corregido
- La hora del evento en el detalle de las reservas, y el recuento de los informes.

## Mayo de 2026

### Añadido
- **Pagos reales activos en producción**, con el TPV de CaixaBank.
- La página de confirmación espera al webhook en producción, en lugar de dar 404 mientras llega.
- El ticket en PDF se descarga solo al confirmar el pago.

### Cambiado
- Las reservas se cierran 4 h antes del evento, en lugar de 5 h.

### Seguridad
- La clave de Redsys sale de los ficheros versionados.

## Abril de 2026

### Añadido
- **Pasarela de pago Redsys**, en modo redirección y con firma HMAC-SHA256. Hasta entonces las
  reservas se confirmaban sin cobrar.
- **Eventos de otros deportes**: 11 deportes con participantes libres y emoji como icono.
- **Protección de asientos entre partidos que se solapan**: un asiento vendido en uno está ocupado
  en el otro.
- Las reservas pendientes caducan a los 5 minutos y liberan sus asientos.

### Cambiado
- **De SQLite a PostgreSQL en Supabase**, con dos entornos: testing y producción.

### Seguridad
Auditoría del 22 de abril, con sus seis hallazgos corregidos:
- la página de confirmación confirmaba la reserva sin pagar;
- el precio llegaba del navegador;
- los crons quedaban abiertos sin `CRON_SECRET`;
- el login no limitaba los intentos;
- las acciones del panel no comprobaban la sesión;
- había una clave de pruebas de Redsys escrita en el código.

## Marzo de 2026

### Añadido
- Bloqueo de asientos por evento, precio por asiento configurable, tickets con QR y mejoras de la
  parte pública.

## Febrero de 2026

### Añadido
- Gestión de usuarios con roles ADMIN y WORKER, eventos pasados e informes mensuales en PDF.
- Integración con football-data.org, con los emblemas de las competiciones.

## Enero de 2026

### Añadido
- **Primera versión**: portada con los eventos, plano de asientos, reservas y panel de
  administración.
