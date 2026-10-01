# Registro de decisiones de arquitectura

Cada documento recoge una decisión que **ya se tomó y está en el código**: el problema que la
motivó, lo que se eligió, lo que se descartó y lo que cuesta. No son propuestas. Las siete
primeras se escribieron en septiembre de 2026 a partir de los planes de cada momento, que están en
[`historico/`](../historico/). La 0008 se escribió en octubre, al tomar la decisión.

| # | Decisión | Fecha |
|---|---|---|
| [0001](0001-redsys-en-modo-redireccion.md) | Cobrar con Redsys en modo redirección, solo con tarjeta | abril 2026 |
| [0002](0002-importes-en-centimos-y-desglose-congelado.md) | Importes en céntimos enteros, desglose congelado en la reserva y `CHECK` en la base | agosto 2026 |
| [0003](0003-recibo-solo-desde-notificacion-firmada.md) | El recibo solo lo escriben el webhook y la ruta de vuelta, y la fecha se guarda como texto | agosto 2026 |
| [0004](0004-ruta-de-vuelta-con-303.md) | Las URL de vuelta de Redsys apuntan a una ruta que redirige con 303, no a las páginas | agosto 2026 |
| [0005](0005-escudos-servidos-en-local.md) | Los escudos se sirven desde `public/`, no desde ESPN | agosto 2026 |
| [0006](0006-una-base-de-datos-por-entorno.md) | Una base de datos por entorno, no por rama, y cada fichero `.env` declara la suya | abril y septiembre 2026 |
| [0007](0007-llave-de-reserva-en-la-url.md) | El cliente abre su reserva con una llave aleatoria en la URL, sin cuenta | septiembre 2026 |
| [0008](0008-funciones-en-la-region-de-la-base.md) | Las funciones de Vercel corren en Dublín, en la misma región que la base de datos | octubre 2026 |

**Sobre las alternativas.** Se reconstruyeron en septiembre de 2026. Cuando el plan de entonces las
discutía, se recogen tal cual. Cuando no, porque la decisión se tomó sin comparar opciones, el
documento lo dice, y las alternativas son las evidentes vistas ahora.

Formato de cada una: **Contexto**, **Decisión**, **Alternativas descartadas** y **Consecuencias**.
Una decisión que se revise no se borra: se marca como sustituida y se enlaza la nueva.
