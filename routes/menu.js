const express = require('express');
const router = express.Router();
const { get_menus } = require("../models/menu.js");
const jwt = require("jsonwebtoken")
const { userAuth } = require("../middlewares/auth.js");
require('dotenv').config();


router.get('/', userAuth, async (req, res) => {  
   try {
    
    const result = await get_menus();

    const categories = result.recordset;

    const categoryMap = new Map();
    
    categories.forEach(item => {
      if (!categoryMap.has(item.PortalCategories_ID)) {
        categoryMap.set(item.PortalCategories_ID, {
          PortalCategories_ID: item.PortalCategories_ID,
          PortalCategoriesName: item.PortalCategoriesName,
          PortalCategoriesLongName: item.PortalCategoriesLongDescription,
          PortalCategoriesDescription: item.PortalCategoriesDescription,
          components: [],
        });
      }

      const category = categoryMap.get(item.PortalCategories_ID);
      category.components.push({
        PortalComponents_ID: item.PortalComponents_ID,
        PortalComponentsName: item.PortalComponentsName,
        PortalComponentsDescription: item.PortalComponentsDescription,
        ExternalLink: item.ExternalLink,
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