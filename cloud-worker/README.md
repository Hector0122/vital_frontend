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

`:nombre` tiene que ser como los que genera la app (`abc123.jpg`); cualquier otra cosa → 404.

## Setup (una vez, desde esta carpeta)

```bash
pnpm install
pnpm exec wrangler login
pnpm exec wrangler secret put API_TOKEN   # pega tu token (no se ve al pegar)
pnpm run deploy                            # anota la URL https://vital-cloud.<subdominio>.workers.dev
curl https://vital-cloud.<subdominio>.workers.dev/health   # → {"ok":true}
```

En la app: Ajustes → Fotos en la nube → URL del Worker + el mismo token.

## Tests

```bash
pnpm test        # handler contra un bucket falso en memoria
pnpm typecheck
```
