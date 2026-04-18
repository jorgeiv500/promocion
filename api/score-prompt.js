const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_PROMPT_RATER_MODEL || 'gpt-4.1-mini';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

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

  if (!trimmed) {
    throw new Error('OpenAI no devolvió contenido para evaluar.');
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('La respuesta del modelo no llegó en JSON válido.');
  }

  return JSON.parse(match[0]);
}

async function parseOpenAIResponse(apiResponse) {
  const raw = await apiResponse.text();

  if (!raw || !raw.trim()) {
    throw new Error('El servicio respondió vacío.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    const excerpt = raw.trim().slice(0, 220);
    throw new Error(`OpenAI devolvió una respuesta no JSON: ${excerpt}`);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'prompt-rater',
      has_key: Boolean(process.env.OPENAI_API_KEY),
      model: MODEL,
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, {
      error: 'Falta OPENAI_API_KEY en el entorno del servidor.',
    });
  }

  const body = parseBody(req.body);
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return sendJson(res, 400, { error: 'Debes enviar un prompt para evaluar.' });
  }

  if (prompt.length > 8000) {
    return sendJson(res, 400, {
      error: 'El prompt es demasiado largo para este evaluador.',
    });
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

    const data = await parseOpenAIResponse(apiResponse);

    if (!apiResponse.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        'OpenAI no pudo procesar la evaluación del prompt.';
      return sendJson(res, apiResponse.status, { error: message });
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJson(content);

    return sendJson(res, 200, {
      score: parsed.score,
      verdict: parsed.verdict,
      summary: parsed.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      improved_prompt: parsed.improved_prompt || '',
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error?.message || 'Error inesperado al calificar el prompt.',
    });
  }
};
