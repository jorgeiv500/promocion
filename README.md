# Taller Ruta 4-22

Presentación estática basada en `reveal.js`, lista para publicarse en GitHub y desplegarse en Vercel.

## Estructura

- `index.html`: presentación principal
- `domo-ai-edition-2025.avif`: infografía Domo
- `70años-fondososcuros.png`: identidad visual Utadeo
- `malla_ingenieria_de_sistemas-20231004 (1).pdf`
- `malla_ingenieria_industrial-20231004 (1).pdf`
- `dist/`: runtime mínimo de Reveal usado por la presentación
- `plugin/chalkboard/`: plugin de anotación
- `plugin/customcontrols/`: navegación personalizada
- `plugin/embed-tweet/`: embeds de tweets
- `vercel.json`: configuración mínima de despliegue

## Deploy en Vercel

1. Sube este repositorio a GitHub.
2. En Vercel, crea un proyecto nuevo e importa el repositorio.
3. Framework Preset: `Other`.
4. Build Command: vacío.
5. Output Directory: vacío.
6. Agrega la variable de entorno `OPENAI_API_KEY` si quieres activar el calificador de prompts.
7. Opcional: agrega `OPENAI_PROMPT_RATER_MODEL` para cambiar el modelo.
8. Deploy.

Vercel servirá `index.html` como sitio estático sin build.

## Variables de entorno

Hay un archivo de ejemplo en `.env.example`.

Para desarrollo local puedes crear:

```bash
cp .env.example .env.local
```

Luego reemplaza:

- `OPENAI_API_KEY` por tu API key real
- `OPENAI_PROMPT_RATER_MODEL` si quieres otro modelo para el evaluador

El archivo `.env.local` no debe subirse al repositorio.
