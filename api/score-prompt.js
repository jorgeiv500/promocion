const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_PROMPT_RATER_MODEL || 'gpt-4.1-mini';

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('La respuesta del modelo no llegó en JSON.');
  }
  return JSON.parse(match[0]);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Método no permitido.' }));
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Falta OPENAI_API_KEY en el entorno del servidor.' }));
    return;
  }

  const body = parseBody(req.body);
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Debes enviar un prompt para evaluar.' }));
    return;
  }

  if (prompt.length > 8000) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'El prompt es demasiado largo para este evaluador.' }));
    return;
  }

  const systemPrompt = `
Eres un evaluador especializado exclusivamente en calificar prompts según la guía oficial de OpenAI.
No eres un chat general y no debes resolver la tarea del usuario. Solo debes evaluar la calidad del prompt.

Evalúa el prompt con base en estas reglas:
1. Claridad y especificidad de la tarea.
2. Contexto suficiente: audiencia, objetivo, tono, restricciones o datos relevantes.
3. Formato de salida pedido de forma explícita.
4. Uso de ejemplos cuando la tarea lo amerita.
5. Posibilidad de iteración o refinamiento útil.

Devuelve solo JSON válido con esta forma exacta:
{
  "score": number,
  "verdict": "texto corto",
  "summary": "explicación breve",
  "strengths": ["..."],
  "missing": ["..."],
  "suggestions": ["..."],
  "improved_prompt": "..."
}

Reglas adicionales:
- score debe ir de 1 a 10.
- strengths, missing y suggestions deben tener entre 2 y 5 elementos cada una cuando sea posible.
- improved_prompt debe ser una versión mejorada del prompt original, no una respuesta a la tarea.
- No menciones políticas, modelos, precios ni temas ajenos a la evaluación.
  `.trim();

  try {
    const apiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Evalúa este prompt y sugiere mejoras estrictamente con base en las reglas indicadas.\n\nPROMPT A EVALUAR:\n${prompt}`,
          },
        ],
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      const message =
        data?.error?.message ||
        'OpenAI no pudo procesar la evaluación del prompt.';
      res.statusCode = apiResponse.status;
      res.end(JSON.stringify({ error: message }));
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJson(content);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        score: parsed.score,
        verdict: parsed.verdict,
        summary: parsed.summary,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        improved_prompt: parsed.improved_prompt || '',
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: error?.message || 'Error inesperado al calificar el prompt.',
      })
    );
  }
};
