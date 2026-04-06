/**
 * Maps rows from tempPortalAISource to PortalComponents_ID values via OpenAI.
 */

const OPENAI_CHAT_COMPLETIONS =
  "https://api.openai.com/v1/chat/completions";

function openAiBearerHeaders(apiKey) {
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
    if (typeof v === "object" && !(v instanceof Date)) {
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
      } catch {
        out[k] = "[object]";
      }
      continue;
    }
    const s = String(v);
    out[k] = s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
  }
  return out;
}

/** Chat message content: string or array of { type, text } parts */
function assistantMessageText(message) {
  if (!message) {
    return "";
  }
  const c = message.content;
  if (typeof c === "string") {
    return c;
  }
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        if (part && typeof part.content === "string") {
          return part.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  const body = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error("OpenAI returned non-JSON");
  }
}

function coerceMatchesArray(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const m = parsed.matches ?? parsed.match ?? parsed.results ?? parsed.data;
  if (Array.isArray(m)) {
    return m;
  }
  return [];
}

function readMatchFields(entry) {
  if (!entry || typeof entry !== "object") {
    return { sourceIndex: NaN, portalId: null };
  }
  const idx =
    entry.sourceIndex ??
    entry.source_index ??
    entry.index ??
    entry.rowIndex ??
    entry.row_index;
  const portalId =
    entry.PortalComponents_ID ??
    entry.portal_components_id ??
    entry.portalComponentsId ??
    entry.componentId ??
    entry.id;
  return {
    sourceIndex: Number(idx),
    portalId: portalId == null ? null : Number(portalId),
  };
}

/**
 * Lighter catalog = fewer tokens and faster responses.
 */
function catalogForPrompt(catalogRows, nameMax = 200, descMax = 120) {
  return catalogRows.map((c) =>
    slimRow(
      {
        PortalComponents_ID: c.PortalComponents_ID,
        PortalComponentsName: c.PortalComponentsName,
        PortalComponentsDescription: c.PortalComponentsDescription,
        PortalComponentsURL: c.PortalComponentsURL,
      },
      nameMax
    )
  );
}

/**
 * @param {object} params
 * @param {Record<string, unknown>[]} params.sourceRows
 * @param {Record<string, unknown>[]} params.catalogRows
 * @param {string} params.apiKey
 * @param {string} [params.model]
 * @param {number} [params.sourceOffset] — global index of first row in this batch
 * @returns {Promise<Set<number>>}
 */
async function matchOneBatch({
  sourceRows,
  catalogRows,
  apiKey,
  model,
  sourceOffset = 0,
}) {
  const set = new Set();
  if (!sourceRows.length || !catalogRows.length) {
    return set;
  }

  const resolvedModel =
    model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const slimSource = sourceRows.map((r, i) => ({
    _index: sourceOffset + i,
    ...slimRow(r, Number(process.env.OPENAI_MATCH_SOURCE_FIELD_MAX || 350)),
  }));
  const slimCatalog = catalogForPrompt(
    catalogRows,
    Number(process.env.OPENAI_MATCH_NAME_MAX || 200),
    Number(process.env.OPENAI_MATCH_DESC_MAX || 120)
  );

  const catalogIds = new Set(
    slimCatalog
      .map((c) => Number(c.PortalComponents_ID))
      .filter(Number.isFinite)
  );

  const userPayload = JSON.stringify({
    sourceRows: slimSource,
    catalogRows: slimCatalog,
  });

  const body = {
    model: resolvedModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "You map patient AI source records to portal component catalog entries.",
          'Reply with ONLY valid JSON (no markdown): {"matches":[{"sourceIndex":0,"PortalComponents_ID":123},...]}.',
          "sourceIndex must equal the _index field from that row in sourceRows (integers 0..n-1).",
          "For each source row, pick one best PortalComponents_ID from catalogRows or null if no good match.",
          "PortalComponents_ID must be an integer from catalogRows or null.",
        ].join(" "),
      },
      { role: "user", content: userPayload },
    ],
  };

  const useJsonObjectFormat =
    (process.env.OPENAI_JSON_RESPONSE_FORMAT || "true").toLowerCase() !==
    "false";
  if (useJsonObjectFormat) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(OPENAI_CHAT_COMPLETIONS, {
    method: "POST",
    headers: openAiBearerHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `OpenAI API error ${res.status}: ${errText || res.statusText}`
    );
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`OpenAI refusal: ${message.refusal}`);
  }

  const text = assistantMessageText(message);
  if (!text) {
    throw new Error("OpenAI returned no message content");
  }

  let parsed;
  try {
    parsed = extractJsonObject(text);
  } catch (e) {
    if (process.env.APP_DB_DEBUG === "true" || process.env.APP_ENV === "development") {
      console.warn(
        "portalAiMatch: could not parse JSON, raw prefix:",
        text.slice(0, 400)
      );
    }
    throw e;
  }

  const matches = coerceMatchesArray(parsed);
  for (const m of matches) {
    const { sourceIndex, portalId } = readMatchFields(m);
    if (!Number.isFinite(sourceIndex) || portalId == null || !Number.isFinite(portalId)) {
      continue;
    }
    if (catalogIds.has(portalId)) {
      set.add(portalId);
    }
  }

  if (
    set.size === 0 &&
    matches.length > 0 &&
    (process.env.APP_DB_DEBUG === "true" || process.env.NODE_ENV === "development")
  ) {
    console.warn(
      "portalAiMatch: model returned matches but none passed catalog ID check. Sample:",
      JSON.stringify(matches.slice(0, 3))
    );
  }

  return set;
}

/**
 * @param {Record<string, unknown>[]} sourceRows
 * @param {Record<string, unknown>[]} catalogRows
 * @param {string} apiKey
 * @param {string} [model]
 * @returns {Promise<Set<number>>}
 */
async function matchAISourceToPortalComponentIds({
  sourceRows,
  catalogRows,
  apiKey,
  model,
}) {
  const merged = new Set();
  if (!apiKey || !sourceRows.length || !catalogRows.length) {
    return merged;
  }

  const batchSize = Math.max(
    5,
    Math.min(
      50,
      Number(process.env.OPENAI_MATCH_SOURCE_BATCH_SIZE || 18)
    )
  );

  if (sourceRows.length <= batchSize) {
    return matchOneBatch({ sourceRows, catalogRows, apiKey, model, sourceOffset: 0 });
  }

  const waveDefs = [];
  for (let i = 0; i < sourceRows.length; i += batchSize) {
    waveDefs.push({
      chunk: sourceRows.slice(i, i + batchSize),
      offset: i,
    });
  }

  const concurrency = Math.min(
    4,
    Math.max(1, Number(process.env.OPENAI_MATCH_PARALLEL_BATCHES || 2))
  );
  for (let w = 0; w < waveDefs.length; w += concurrency) {
    const wave = waveDefs.slice(w, w + concurrency);
    const sets = await Promise.all(
      wave.map(({ chunk, offset }) =>
        matchOneBatch({
          sourceRows: chunk,
          catalogRows,
          apiKey,
          model,
          sourceOffset: offset,
        })
      )
    );
    for (const s of sets) {
      for (const id of s) {
        merged.add(id);
      }
    }
  }

  return merged;
}

module.exports = {
  matchAISourceToPortalComponentIds,
};
