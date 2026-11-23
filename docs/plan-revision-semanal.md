# Plan: mejorar "Cómo te fue" (revisión semanal)

Estado: **plan, sin implementar**. Se retoma en sesión de trabajo en laptop.
Fecha: 2026-11-22

## Problema

El resumen semanal solo lista actividades y conteos. No dice cómo vamos, ignora las notas y
las sensaciones por día, y a veces contradice lo que pedí. Quiero que sea honesto sin ser
agresivo: que diga qué metas no registramos y proponga algo concreto para la siguiente
semana.

## Hallazgos (revisando el código y el respaldo del 2026-11-22)

1. **El worker nunca recibe notas.** Lo dice el comentario de `cloud-worker/src/revision.ts`
   ("solo conteos y sensaciones — nunca notas ni fotos"). `construirEntrada` en
   `src/services/revision.ts` manda las sensaciones como conteo total
   (`{Contento: 4, Cansado: 2}`), sin día ni actividad.
2. **La semana 16–22 nov cayó al respaldo por reglas** (`fuente: 'reglas'`, sin etiqueta IA),
   porque falló Groq. `revisionPorReglas` junta `balanceSemana` con `resumenSemana().frase`
   ("Registraste X tres veces…"), y de ahí sale la lista.
3. **La IA contradijo el enfoque.** El enfoque de la semana 9 era "Quiero dibujar y quitar
   comer con calma", y aun así sugirió Comer con calma y no Dibujo.
4. **Metas equivocadas en semanas pasadas.** `metaAnterior` sale de `a.metaSemanal`
   *actual*, no de la meta que se tenía esa semana. Las metas reales de la semana N son
   las `aceptadas` de la revisión de la semana N-1.
5. **"Metas que elegiste" confunde.** En `SemanaScreen.tsx` muestra las metas que elegí
   *para la semana siguiente*, no las de esa semana. Cuando la actividad se borró, aparece
   "actividad 1×" (el nombre de respaldo de `actividadDe(...)?.nombre ?? 'actividad'`).
6. **La primera semana tuvo solo 3 días** (empecé el viernes 13). Hay que decirlo en vez de
   tratarla como una semana completa.
7. **Registros sin nota.** El bajo del jueves 19 no tenía nota, y un resumen hecho a mano lo
   excluyó de "ensayos con el grupo" cuando sí fue ensayo. La IA no debe suponer de qué se
   trató un registro sin nota.

## Cambios

### 1. Entrada a la IA (`src/services/revision.ts` → `construirEntrada`)

Agregar, sin quitar lo existente (para que sea compatible con el worker actual):

```ts
registros: {
  fecha: string;        // 'YYYY-MM-DD'
  dia: string;          // 'martes'
  actividadId: string;
  actividad: string;
  area: string;
  minutos?: number;
  todoElDia?: boolean;  // ver punto 7
  sensacion?: string;
  nota?: string;        // recortada a ~300 caracteres
}[];
diasUsandoApp: number;  // días de la semana desde el primer registro histórico (semana parcial)
metas: { actividadId: string; nombre: string; meta: number; dias: number }[]; // metas REALES de esa semana
```

- Las metas de la semana N salen de `revisiones[N-1].aceptadas`. Si no existen, usar
  `metaSemanal` como respaldo.
- Excluir actividades eliminadas o inactivas de las sugerencias, pero mostrar su meta
  como "ya la quitaste" si aplica.
- Actualizar el comentario de cabecera: ahora sí se envían notas (decisión tomada:
  ok mandar notas a Groq).

### 2. Worker (`cloud-worker/src/revision.ts`)

- `validarEntrada`: aceptar `registros` (≤ 80), `metas`, `diasUsandoApp`. Notas ≤ 300
  caracteres. Sigue aceptando el formato viejo.
- `limpiarSalida`: subir el límite de `analisis` de 700 a ~1200 caracteres; en
  `llamarGroq`, `max_completion_tokens` de 800 a ~1200.
- Las sugerencias no pueden incluir actividades que el enfoque pide quitar (filtrar en el
  prompt **y** en código, si se puede detectar por nombre).

### 3. Prompt nuevo (`SISTEMA`)

Estructura del análisis (~150 palabras, 3–4 párrafos cortos, sin listas):

1. **Lo que destacó**: 1–3 momentos concretos sacados de las notas (lo terminado, lo
   retomado, lo que dije que disfruté).
2. **Metas**: estado claro de cada una. "Caminata se cumplió, 3 días contra 1."
   "Dibujo no lo registramos ningún día."
3. **Patrón de sensaciones** ligado a actividades, si existe ("los días con ejercicio o
   caminata, con energía; el cansancio vino con Gnex y el bajo").
4. **Una sugerencia** concreta y pequeña para la siguiente semana. Cierre tipo
   "veamos cómo nos va".

Reglas de tono:
- Plural cuando hable de lo que faltó ("no lo registramos", "veamos cómo nos va").
- Nombrar lo que faltó, sin calificarlo de "mal" ni regañar. Nada de elogios vacíos:
  reconocer solo cosas concretas.
- Nunca listar actividades una por una (eso ya está en las tarjetas).

Reglas de datos:
- **No inventar.** Un registro sin nota se describe solo con días y horas.
- No usar la nota de un día para deducir qué pasó en otro día sin nota (ni para incluirlo ni
  para excluirlo).
- **El enfoque manda**: si pido dejar algo, no sugerirlo; si pido hacer algo, priorizarlo.
- Área **Trabajo** no es creatividad ni descanso; mencionarla aparte si pesó en la semana.
- **Semana parcial** (`diasUsandoApp < 7`): decirlo y no comparar como si fuera completa.
- "Todo el día" vale como el día dedicado a eso, no como 8 h.

### 4. Respaldo por reglas (`revisionPorReglas`)

Cuando falle Groq, que no quede en una lista:
- Quitar `resumenSemana().frase` ("Registraste X tres veces…").
- Decir el estado de cada meta ("Caminata: 3 de 1. Dibujo: no la registramos.").
- Incluir 1 nota destacada (la más larga o la de un registro "Contento") textual y corta.
- Investigar por qué falló Groq el 22-nov (logs de Cloudflare `wrangler tail`).

### 5. Regenerar revisiones pasadas

- `regenerarRevision(semana)` en `src/services/revision.ts`: construye la entrada para esa
  semana (con las metas reales del punto 1), llama a la IA y reemplaza **solo**
  `analisis` y `fuente`. Conserva `estado`, `aceptadas` y `sugerencias` si ya se aplicaron.
- Botón chico "Rehacer" en la tarjeta "Cómo te fue" de `SemanaScreen.tsx` (y quizá en
  `RevisionCard`). Toast si falla la IA (no sobreescribir con reglas).
- Usarlo para rehacer las semanas 2026-11-09 y 2026-11-16.

### 6. Etiquetas en la tarjeta

- "Metas que elegiste" → "Metas para la siguiente semana".
- Guardar el `nombre` dentro de `aceptadas` para que una actividad borrada no salga como
  "actividad".

### 7. Duración "Todo el día"

- `Registro.todoElDia?: boolean` (marca, **no** un número fijo de minutos, para no inflar
  totales ni chocar con otras actividades del mismo día).
- Chip "Todo el día" en `RegistroScreen.tsx` junto a `DURACIONES`; es excluyente con los
  minutos.
- `RegistroItem` y las tarjetas de Mi semana muestran "todo el día" en lugar de horas.
- Lo que se hizo ese día va en la nota (plaza, comida, partido). Las actividades con meta
  (ej. Caminata) se registran aparte con nota "con los niños".
- Revisar respaldo/restauración (`src/services/backup.ts`) y nube: campo opcional,
  compatible con respaldos viejos.
- No hacer actividades anidadas.

## Orden de despliegue

1. Worker primero, compatible con el formato viejo → `wrangler deploy`.
2. App → release con tag de versión (el CI solo corre con tags).
3. En la app: "Rehacer" en las semanas 9 y 16 de nov y comparar con los ejemplos de abajo.

## Pruebas

- `cloud-worker/test/revision.test.ts`: validación de `registros`, `metas`, límites, formato
  viejo.
- `__tests__/revision.test.ts`: `construirEntrada` con metas reales desde `aceptadas`,
  semana parcial, actividad eliminada; `regenerarRevision` conserva `aceptadas`;
  respaldo por reglas sin lista.
- Fixture basado en el respaldo del 22-nov, **anonimizado** (sin notas reales en el repo).

## Resultado esperado (referencia, hecho a mano con el respaldo)

**9–15 nov**

> Empezaste a registrar el viernes, así que fueron tres días, y bien aprovechados. El domingo
> fue completo con tus hijos, 8 horas; como tú dijiste, los domingos son para ellos. El
> sábado retomaste Raccoon Cyberpunk desde el level 01, ahora todo a mano: más complicado,
> pero se ve mejor y se siente más divertido. También terminaste Little Nightmares y Limbo, y
> del primero sacaste ideas para tu propio juego.
>
> Casi todo lo registraste como contento o tranquilo; el cansancio apareció en las 4 horas de
> Raccoon y en el bajo.
>
> Te propusiste dibujar y quitar Comer con calma. Para la próxima: Dibujo, una vez.

**16–22 nov**

Ojo: el ensayo del jueves 19 no tiene nota en el respaldo (lo aclaré en la conversación).
Con los datos tal como están, la IA debería decir "tres días de bajo, con ensayo y evento";
para que diga lo de abajo, agregar la nota "Ensayo con el grupo" a ese registro.

> Registraste algo los siete días, y fue una semana muy cargada con el grupo: ensayaron el
> martes y el jueves y el viernes tocaron en un evento, 8 horas de bajo en total. Además
> terminaste La Carretera, retomaste Varo después de tenerla abandonada, arrancaste Vibes, y
> el viernes fuiste al baile de tu hijo.
>
> Metas: Caminata se cumplió de sobra, 3 días contra 1. Comer con calma no se registró, pero
> ya la quitaste. Dibujo, que querías desde la semana pasada, sigue sin aparecer.
>
> Siempre que hiciste ejercicio o caminata te sentiste con energía; el cansancio vino sobre
> todo con Gnex y con el bajo. Gnex sumó 10 horas, y es trabajo, no creatividad.
>
> Para la próxima: mantener 2 caminatas y meter un rato de dibujo, aunque sea corto. Veamos
> cómo nos va.
