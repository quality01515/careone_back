const jwt = require("jsonwebtoken");
const { check_login } = require("../models/auth");

const userAuth= (async (req, res, next)=>{
    try{
        // Check Authorization header (Express normalizes headers to lowercase)
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        console.log("--->>>", authHeader);

        let token = null;

        // Try to get token from Authorization header first (Bearer token)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            // Fallback to cookie if Authorization header is not present
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decodedObj = await jwt.verify(token, "CAREONE_JOURNEY");
        const {last_name, formattedDob, phone_email}= decodedObj;

        const result = await check_login(last_name, formattedDob, phone_email);

        console.log('Query Result:', result.recordset);  

        if (result.recordset.length > 0) {
            // User is authenticated, attach user info to request and proceed
            req.user = { last_name, formattedDob, phone_email };
            next();
        } else {
            // User not found in database
            return res.status(401).json({ error: 'User not found' });
        }  

    }catch(err){
        res.status(400).send("ERROR: "+ err.message);
    }

})

module.exports= {
    userAuth,  
}