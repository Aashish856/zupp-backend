const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin.js');
const auth = require('../middlewares/Auth.js');

// Send OTP for admin registration
router.post('/send-register-otp', adminController.sendRegisterOtp);

// Verify registration OTP and create admin
router.post('/verify-register-otp', adminController.verifyRegisterOtp);

// Send OTP for login
router.post('/send-login-otp', adminController.sendLoginOtp);

// Verify login OTP and return token
router.post('/verify-login-otp', adminController.verifyLoginOtp);

// Get admin by ID
router.get('/:id', auth(["admin"]), adminController.getAdminById);

module.exports = router;
