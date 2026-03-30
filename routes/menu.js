const express = require("express");
const router = express.Router();
const {
  get_menus,
  get_temp_portal_ai_source,
  get_portal_components_catalog,
} = require("../models/menu.js");
const { userAuth } = require("../middlewares/auth.js");
const {
  matchAISourceToPortalComponentIds,
} = require("../services/portalAiMatch.js");
require("dotenv").config();

router.post("/", userAuth, async (req, res) => {
  try {
    const patient_id = req.body.patient_id;

    const [result, aiSourceRows, catalogRows] = await Promise.all([
      get_menus(patient_id),
      get_temp_portal_ai_source(patient_id),
      get_portal_components_catalog(),
    ]);

    const categories = result.recordset;
    const apiKey = process.env.OPENAI_API_KEY;

    let aiMatchedComponentIds = new Set();
    if (apiKey && aiSourceRows.length && catalogRows.length) {
      try {
        aiMatchedComponentIds = await matchAISourceToPortalComponentIds({
          sourceRows: aiSourceRows,
          catalogRows,
          apiKey,
        });
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
      category.components.push({
        PortalComponents_ID: item.PortalComponents_ID,
        PortalComponentsName: item.PortalComponentsName,
        PortalComponentsDescription: item.PortalComponentsDescription,
        PortalComponentsURL: item.PortalComponentsURL,
        ExternalLink: item.ExternalLink,
        Hidden: item.Hidden == 0 ? 0 : 1,
        aiSourceMatch: aiMatchedComponentIds.has(pid),
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
