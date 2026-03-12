const express = require('express');
const router = express.Router();
const { check_login, check_HRA_status } = require("../models/auth");
const jwt = require("jsonwebtoken")
require('dotenv').config();

router.post('/', async (req, res) => {
  try {

    const last_name = req.body.last_name;
    const dob = req.body.converted_dob;
    const phone_email = req.body.phone_number;

    console.log('last_name:', last_name); 
    console.log('dob:', dob);              
    console.log('phone_email:', phone_email);  

    const formattedDob = new Date(dob).toISOString().split('T')[0]; 

    const result = await check_login(last_name, formattedDob, phone_email);

    if (result.recordset.length > 0) {
      const token = await jwt.sign({last_name, formattedDob, phone_email}, "CAREONE_JOURNEY", {expiresIn: "1h"});

      res.cookie("token", token, {
          // expires: new Date(Date.now() + 1800000),
          expires: new Date(Date.now() + 2000),
          httpOnly: true, 
      });

      let patient_id = result.recordset[0]['Patient_ID'];
      let first_name = result.recordset[0]['FirstName'];
      // Use actual DOB from database (source of truth), not user input
      const dbDob = result.recordset[0]['DOB'];
      const dobForClient = dbDob
        ? new Date(dbDob).toISOString().split('T')[0]
        : formattedDob;

      const hra_status = await check_HRA_status(patient_id)

      res.json({
        status: true,
        token,
        patient_id,
        first_name,
        last_name,
        dob: dobForClient,
        ...hra_status
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
