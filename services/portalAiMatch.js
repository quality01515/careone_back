/**
 * Maps rows from tempPortalAISource to PortalComponents_ID values via OpenAI.
 */

function chatCompletionsUrl() {
  const full = process.env.OPENAI_CHAT_COMPLETIONS_URL?.trim();
  if (full) {
    return full;
  }
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
  return `${base}/chat/completions`;
}

/** @returns {Record<string, string>} */
function openAiHeaders(apiKey) {
  const style = (process.env.OPENAI_AUTH_HEADER || "bearer").toLowerCase();
  if (style === "api-key" || style === "apikey") {
    return {
      "api-key": apiKey,
      "Content-Type": "application/json",
    };
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function slimRow(row, maxLen = 400) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    const s = String(v);
    out[k] = s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
  }
  return out;
}

/**
 * @param {object} params
 * @param {Record<string, unknown>[]} params.sourceRows - tempPortalAISource rows
 * @param {Record<string, unknown>[]} params.catalogRows - visible PortalComponents rows
 * @param {string} params.apiKey
 * @param {string} [params.model]
 * @returns {Promise<Set<number>>} PortalComponents_IDs that best match any source row
 */
async function matchAISourceToPortalComponentIds({
  sourceRows,
  catalogRows,
  apiKey,
  model,
}) {
  const set = new Set();
  if (!apiKey || !sourceRows.length || !catalogRows.length) {
    return set;
  }

  const resolvedModel =
    model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const slimSource = sourceRows.map((r, i) => ({ _index: i, ...slimRow(r) }));
  const slimCatalog = catalogRows.map((c) =>
    slimRow({
      PortalComponents_ID: c.PortalComponents_ID,
      PortalCategories_ID: c.PortalCategories_ID,
      PortalComponentsName: c.PortalComponentsName,
      PortalComponentsDescription: c.PortalComponentsDescription,
      PortalComponentsURL: c.PortalComponentsURL,
      ExternalLink: c.ExternalLink,
    })
  );

  const catalogIds = new Set(
    slimCatalog.map((c) => Number(c.PortalComponents_ID)).filter(Number.isFinite)
  );

  const userPayload = JSON.stringify({
    sourceRows: slimSource,
    catalogRows: slimCatalog,
  });

  const res = await fetch(chatCompletionsUrl(), {
    method: "POST",
    headers: openAiHeaders(apiKey),
    body: JSON.stringify({
      model: resolvedModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You map patient AI source records to portal component catalog entries.",
            'Return strict JSON: {"matches":[{"sourceIndex":<number>,"PortalComponents_ID":<number|null>},...]}.',
            "For every source row (use _index as sourceIndex), choose the single best matching PortalComponents_ID from catalogRows by name, description, and URL meaning.",
            "PortalComponents_ID must be an integer that appears in catalogRows, or null if there is no confident match.",
            "Include one match object per source row, in any order.",
          ].join(" "),
        },
        { role: "user", content: userPayload },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let msg = `OpenAI API error ${res.status}: ${errText || res.statusText}`;
    if (
      res.status === 403 &&
      /unsupported_country|request_forbidden/i.test(errText)
    ) {
      msg +=
        " If your region blocks api.openai.com, use Azure OpenAI (OPENAI_CHAT_COMPLETIONS_URL + OPENAI_AUTH_HEADER=api-key) or another OpenAI-compatible endpoint via OPENAI_BASE_URL.";
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned no message content");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI returned non-JSON");
  }

  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
  for (const m of matches) {
    const id = m.PortalComponents_ID;
    if (id == null) continue;
    const n = Number(id);
    if (Number.isFinite(n) && catalogIds.has(n)) {
      set.add(n);
    }
  }

  return set;
}

module.exports = {
  matchAISourceToPortalComponentIds,
};
