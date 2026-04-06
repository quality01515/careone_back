const express = require("express");
const router = express.Router();
const {
  get_menus,
  get_temp_portal_ai_source,
  get_portal_components_catalog,
  ensureHraTempPortalAISource,
} = require("../models/menuAiMatch.js");
const { userAuth } = require("../middlewares/auth.js");
const {
  matchAISourceToPortalComponentIds,
} = require("../services/menuAiMatch.js");
require("dotenv").config();

router.post("/", userAuth, async (req, res) => {
  try {
    const patient_id = req.body.patient_id;

    const hra = await ensureHraTempPortalAISource(patient_id);
    const [result, catalogRows] = await Promise.all([
      get_menus(patient_id),
      get_portal_components_catalog(),
    ]);

    const aiSourceRows = hra.ok
      ? await get_temp_portal_ai_source(patient_id, hra.encounterId)
      : [];

    if (
      !hra.ok &&
      (process.env.APP_DB_DEBUG === "true" || process.env.NODE_ENV === "development")
    ) {
      console.warn(`menuAiMatch: ${hra.code}`, hra.message || "");
    }

    const categories = result.recordset;
    const apiKey = process.env.OPENAI_API_KEY;

    let aiMatchedComponentIds = new Set();
    if (apiKey && aiSourceRows.length && catalogRows.length) {
      try {
        const t0 = Date.now();
        aiMatchedComponentIds = await matchAISourceToPortalComponentIds({
          sourceRows: aiSourceRows,
          catalogRows,
          apiKey,
        });
        if (process.env.APP_DB_DEBUG === "true") {
          console.log(
            `portal AI match: ${Date.now() - t0}ms, sourceRows=${aiSourceRows.length}, matchedIds=${aiMatchedComponentIds.size}`
          );
        }
      } catch (aiErr) {
        console.error("OpenAI portal match failed:", aiErr.message || aiErr);
      }
    } else if (!apiKey && aiSourceRows.length) {
      console.warn(
        "OPENAI_API_KEY is not set; skipping tempPortalAISource → PortalComponents matching."
      );
    }

    const categoryMap = new Map();

    categories.forEach((item) => {
      if (item.PortalComponents_ID == null) {
        return;
      }

      if (!categoryMap.has(item.PortalCategories_ID)) {
        categoryMap.set(item.PortalCategories_ID, {
          PortalCategories_ID: item.PortalCategories_ID,
          PortalCategoriesName: item.PortalCategoriesName,
          PortalCategoriesLongName: item.PortalCategoriesLongDescription,
          PortalCategoriesDescription: item.PortalCategoriesDescription,
          PortalCategoriesURL: item.PortalCategoriesURL,
          components: [],
        });
      }

      const category = categoryMap.get(item.PortalCategories_ID);
      const pid = Number(item.PortalComponents_ID);
      const aiHit =
        Number.isFinite(pid) && aiMatchedComponentIds.has(pid);
      category.components.push({
        PortalComponents_ID: item.PortalComponents_ID,
        PortalComponentsName: item.PortalComponentsName,
        PortalComponentsDescription: item.PortalComponentsDescription,
        PortalComponentsURL: item.PortalComponentsURL,
        ExternalLink: item.ExternalLink,
        Hidden: item.Hidden == 0 ? 0 : 1,
        aiSourceMatch: aiHit,
      });
    });

    const responseData = [...categoryMap.values()];

    res.json(responseData);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
