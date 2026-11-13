# Vital Cloud Worker

Guarda las fotos de Vital en el bucket R2 `vital`. Un solo usuario y un solo
token. Escribe con el binding de R2, así que **no usa llaves S3**: el único
secret es `API_TOKEN`. Patrón tomado de `velody/cloud-worker` (`src/auth.ts` es
copia literal).

## API

| Método | Ruta | |
|---|---|---|
| GET | `/health` | sin token |
| PUT | `/fotos/:nombre` | cuerpo = jpeg, `Authorization: Bearer <API_TOKEN>` |
| GET | `/fotos/:nombre` | |
| DELETE | `/fotos/:nombre` | |
| POST | `/revision` | resumen de la semana (conteos y sensaciones, sin notas) → `{analisis, sugerencias}` vía Groq |

`:nombre` tiene que ser como los que genera la app (`abc123.jpg`); cualquier otra cosa → 404.

## Setup (una vez, desde esta carpeta)

```bash
pnpm install
pnpm exec wrangler login
pnpm exec wrangler secret put API_TOKEN      # pega tu token (no se ve al pegar)
pnpm exec wrangler secret put GROQ_API_KEY   # llave de Groq para la revisión semanal (opcional)
pnpm run deploy                            # anota la URL https://vital-cloud.<subdominio>.workers.dev
curl https://vital-cloud.<subdominio>.workers.dev/health   # → {"ok":true}
```

En la app: Ajustes → Nube e IA → URL del Worker + el mismo token.

Modelo de Groq: `openai/gpt-oss-120b` (como Veya); para cambiarlo, agrega `GROQ_MODEL` en `[vars]`.
Si Groq falla, `/revision` responde 502 y la app arma la revisión con reglas locales.

## Tests

```bash
pnpm test        # handler contra un bucket falso en memoria
pnpm typecheck
```
