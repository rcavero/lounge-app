# 0008 · Las funciones de Vercel corren en Dublín, en la misma región que la base de datos

**Estado:** vigente · **Fecha:** octubre de 2026 · **Plan:** `MASTER_IA.md`, apartado P13.6

## Contexto

Vercel ejecuta las funciones en Washington (`iad1`) si nadie dice otra cosa, y nadie lo había
dicho. Las dos bases de Supabase, testing y producción, están en Irlanda (`eu-west-1`). Así que
**cada consulta a la base cruzaba el Atlántico**, y una página que hace varias consultas seguidas
pagaba esa ida y vuelta en cada una.

Se vio el 1 de octubre de 2026, al revisar en los logs de Vercel un error del pool de conexiones
en el arranque en frío del despliegue de la fusión. El detalle de la petición decía «Routed to
Washington, D.C., USA (iad1)».

Importa por dos motivos:

- **La lentitud.** La página de un evento, la del plano y los asientos, tardaba casi 3 segundos en
  completarse.
- **El pool de conexiones.** Cuanto más dura cada consulta, más tiempo está ocupada cada conexión.
  Es el modo de fallo del incidente del 17 de julio, en la apertura de reservas de la final del
  Mundial: con la misma demanda, unas consultas más lentas agotan antes un pool de 5 conexiones.

En el plan Hobby de Vercel solo se puede elegir **una** región.

## Decisión

**`"regions": ["dub1"]` en `vercel.json`.** Dublín es la misma región de AWS que Supabase
(`eu-west-1`).

- Vale para producción y para todas las previews.
- Manda sobre el ajuste del panel de Vercel (Settings → Functions → Function Region).
- Se comprueba en la cabecera `x-vercel-id` de cualquier respuesta, por ejemplo
  `cdg1::dub1::…`. El primer código es el punto de entrada de la red de Vercel, y el segundo, la
  región donde se ejecutó la función.

## Alternativas descartadas

- **Cambiarlo en el panel de Vercel.** Es el mismo efecto con dos clics, pero no queda en git, y el
  siguiente despliegue de cualquier rama lo hereda sin pasar antes por testing.
- **Llevar la base a Estados Unidos.** Los clientes y el bar están en España, habría que migrar las
  dos bases, y no aporta nada frente a mover las funciones.
- **Varias regiones.** El plan Hobby no las permite y, con una sola base, tampoco servirían: cada
  región seguiría consultando en Irlanda.
- **Dejarlo y arreglar solo el pool** (los arreglos P0 del incidente de julio). No son
  alternativas: el pool sigue haciendo falta, y la región reduce el tiempo que cada consulta
  retiene una conexión.

## Consecuencias

**Medido el 1 de octubre de 2026** contra la preview de testing, con la misma base y el mismo
código (`ab86e11`), antes y después del cambio:

| Página | `iad1` (Washington) | `dub1` (Dublín) | Mejora |
|---|---|---|---|
| Un evento: el plano y los asientos | 2,967 s | 0,258 s | −91,3 %, 11,5 veces más rápida |
| Portada | 0,864 s | 0,188 s | −78,2 %, 4,6 veces más rápida |

- Son medianas de 9 peticiones de **tiempo total** de la respuesta (`curl -w %{time_total}`),
  desde Valencia. El método completo y los mínimos y máximos están en `MASTER_IA.md`, P13.6.
- Ojo al medir: el tiempo hasta el primer byte no sirve aquí. Con `loading.tsx`, la página envía
  el esqueleto antes de consultar la base, y ese tiempo salía en ~0,22 s tanto en Washington como
  en Dublín.

Además:

- **Las páginas llegan completas.** La del evento trae el plano con sus 47 asientos, y ni el HTML
  ni los logs de Vercel muestran errores.
- **No arregla el pool.** Reduce cuánto se retiene cada conexión, pero los arreglos P0 del
  incidente de julio siguen pendientes: escrituras en rutas GET, consultas sin caché y un pool de
  5 por función.
- **Si la base cambia de región, esto también.** Las dos cosas tienen que ir juntas.
- **Los crons y el webhook de Redsys** corren igualmente en Dublín. No cambia nada para ellos.
- **Volver atrás:** quitar la línea de `vercel.json`, o el Instant Rollback de Vercel al
  despliegue anterior.
