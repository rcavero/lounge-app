# Cómo se trabaja en este repositorio

Es el proyecto de un solo desarrollador, que revisa los planes con la propietaria del bar y con
otro ingeniero, y que trabaja con un asistente de IA. Estas son las reglas que se siguen. Valen
igual para una persona que para la IA.

## Ramas

| Rama | Qué es | Cómo llega el código |
|---|---|---|
| `main` | **Producción.** Cobra dinero real | Solo desde `testing`, en fast-forward, después de probar allí |
| `testing` | La web de pruebas del bar, con la pasarela de pruebas | Desde `academic`, en fast-forward |
| `academic` | La rama de trabajo, con los tests y la CI. Fue la de la entrega del máster | Aquí se desarrolla cada cambio |

Un cambio se hace en `academic`, pasa a `testing`, se usa allí unos días y solo después pasa a
`main`. Las tres ramas avanzan en fast-forward, así que producción despliega exactamente el commit
que se probó en testing.

Hasta el 1 de octubre de 2026, mientras duró la entrega del máster, `academic` iba por su cuenta
y `main` y `testing` no se tocaron, salvo dos arreglos decididos explícitamente: una corrección
de comentarios en la Fase −1 y el arreglo de la carrera de asientos en P7. Ese día se fusionaron
las tres (`MASTER_IA.md`, P13).

Cada push despliega en Vercel. **Se agrupan los commits y se sube al cerrar un bloque de trabajo**,
no uno a uno.

## Antes de empezar un cambio con riesgo

Un cambio que toca dinero, el esquema de la base o algo que ve el cliente **se planifica por
escrito antes de programarlo**. El plan va como `.md` en la raíz, para comentarlo con la
propietaria y con el otro ingeniero; los pasos de la entrega del máster, en `MASTER_IA.md`. Un plan
dice qué se cambia, qué se descarta y por qué, cómo se va a comprobar, y qué decisiones quedan
pendientes y de quién son.

Los planes ya ejecutados se guardan en [`docs/historico/`](docs/historico/), sin editar.

## Commits

Mensajes en español, con un prefijo de [Conventional Commits](https://www.conventionalcommits.org/es/):

| Prefijo | Para |
|---|---|
| `feat:` | Algo nuevo que ve o usa alguien |
| `fix:` | Un fallo corregido |
| `test:` | Tests nuevos o cambiados, sin tocar el código de la app |
| `refactor:` | Reorganizar código sin cambiar lo que hace |
| `docs:` | Documentación |
| `style:` | Solo formato |
| `ci:`, `chore:` | CI, dependencias, configuración |

Se puede añadir el ámbito entre paréntesis: `fix(payments):`, `feat(admin):`.

- **La primera línea dice qué cambia.** El cuerpo explica **por qué**, qué se descartó y cómo se
  comprobó. El `git log` es la única historia que sobrevive al código.
- **Commits pequeños y de una sola cosa.** Un commit de formato no lleva cambios de lógica: así se
  revisa en segundos, y el de lógica se lee sin ruido.
- **Un fallo se corrige en dos pasos**: primero el test que lo reproduce, visto en rojo, y después
  el arreglo. Si el test no compila sin el arreglo, van juntos y el mensaje lo dice.
- **La referencia a la tarjeta de Linear** va al final del cuerpo: `Refs RCA-285`.
- **Si el commit lo ha escrito un asistente de IA**, lleva la línea `Co-Authored-By` que lo
  identifica.

## Lo que se comprueba solo

- **Al commitear** (husky y lint-staged): Prettier y ESLint sobre los ficheros del commit, y la
  comprobación de tipos del proyecto entero. La suite no corre aquí, a propósito: un hook de un
  minuto se acaba saltando.
- **Nunca `--no-verify`.** Si el hook falla, se arregla la causa.
- **Al subir** (GitHub Actions): lint, tipos, formato, unitarios, integración con cobertura y
  umbrales, y E2E. Ver [`docs/testing.md`](docs/testing.md#ci).

## Antes de subir

```bash
npm run lint && npm run typecheck && npm run format:check
npm test
npm run db:up && npm run test:integration
npm run e2e
```

Y además, según lo que se toque:

| Si el cambio… | Hace falta |
|---|---|
| añade una server action | que se proteja a sí misma (`requireAuth`, `requireAdmin` o la llave de la reserva). Si es del panel, añadirla a `tests/integration/roles.test.ts` |
| toca el camino del pago | **un pago real en la preview, antes y después del push**, y comparar las dos reservas en la base de testing |
| cambia el esquema | una migración con `npm run db:migrate`, nunca `db push`. Comprobar que es compatible con el código ya desplegado, porque se aplica antes que él. Ver [`docs/entornos.md`](docs/entornos.md#migrar-una-base-remota) |
| toca una base remota | `npm run db:whoami:testing` o `:prod` antes de nada |
| cambia una regla de negocio | la regla en `domain/`, con sus tests unitarios, y comprobar que el test falla si se rompe la regla |
| cambia algo visible | revisarlo en el móvil, en la preview |

## Estilo

- **TypeScript estricto** y el formato de Prettier. No se discute: lo aplica el hook.
- **Los comentarios explican el porqué**, no el qué, sobre todo donde una decisión no es obvia o
  ya costó un error. Muchos comentarios del código cuentan precisamente eso.
- **La interfaz, los mensajes y la documentación, en español.** En la parte pública, los textos
  que explican reglas (avisos, condiciones, el modal del nombre) tienen también su versión en
  inglés, con `useIsSpanish`. Un texto nuevo de ese tipo lleva las dos.
- **La arquitectura que hay que respetar está en [`CLAUDE.md`](CLAUDE.md)**, que es también lo que
  lee la IA antes de tocar nada. Si un cambio la modifica, se actualiza ese fichero en el mismo
  commit.
