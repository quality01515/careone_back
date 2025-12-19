const express = require('express');
const router = express.Router();
const { check_login } = require("../models/auth");
const { get_menus } = require("../models/menu");
const jwt = require("jsonwebtoken")
const { userAuth } = require("../middlewares/auth.js");
require('dotenv').config();


router.get('/menu', userAuth, async (req, res) => {  
   try {
    
    const result = await get_menus();

    const categories = result.recordset;

    const categoryMap = new Map();
    
    categories.forEach(item => {
      if (!categoryMap.has(item.PortalCategories_ID)) {
        categoryMap.set(item.PortalCategories_ID, {
          PortalCategories_ID: item.PortalCategories_ID,
          PortalCategoriesName: item.PortalCategoriesName,
          PortalCategoriesLongName: item.PortalCategoriesLongName,
          CategoryDescription: item.CategoryDescription,
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

router.post('/login', async (req, res) => {
  try {

    const last_name = req.body.last_name;
    const dob = req.body.converted_dob;
    const phone_email = req.body.phone_number;

    console.log('last_name:', last_name); 
    console.log('dob:', dob);              
    console.log('phone_email:', phone_email);  

    const formattedDob = new Date(dob).toISOString().split('T')[0]; 

    const result = await check_login(last_name, formattedDob, phone_email);

    console.log('Query Result:', result.recordset);  

    if (result.recordset.length > 0) {
      const token = await jwt.sign({last_name, formattedDob, phone_email}, "CAREONE_JOURNEY", {expiresIn: "1h"});

      res.cookie("token", token, {
          expires: new Date(Date.now() + 3600000),
          httpOnly: true, 
      });
      res.json({
        status: true,
        token
      }); 
    } else {
      res.json({
        status: false
      }); 
    }

  } catch (err) {
    console.error("Error:", err);
    res.json({ 
      status: false,
      error: err.message 
    });
  }
});

router.get('/test', async (req, res) => { 
  console.log("Successful !!!");
  return res.send("Successful !!!");  
});

module.exports = router;
