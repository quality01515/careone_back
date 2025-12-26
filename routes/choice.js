const express = require('express');
const router = express.Router();
const { update_choices } = require("../models/choice.js");
const jwt = require("jsonwebtoken")
const { userAuth } = require("../middlewares/auth.js");
require('dotenv').config();


router.post('/update', userAuth, async (req, res) => {  
   try {
    let patient_id = req.body.patient_id;
    let components = req.body.components;

    const result = await update_choices(patient_id, components);

    res.json(result);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;