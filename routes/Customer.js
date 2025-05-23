const express = require('express');
const router = express.Router();
const customerController = require('../controllers/Customer.js');
const auth = require('../middlewares/Auth.js');

// Registration: send OTP
router.post('/register', customerController.sendRegisterOtp);

// Registration: verify OTP & create account
router.post('/verify-register-otp', customerController.verifyRegisterOtp);

// Login: send OTP
router.post('/login', customerController.sendLoginOtp);

// Login: verify OTP & generate token
router.post('/verify-login-otp', customerController.verifyLoginOtp);

// Get customer by ID
router.get('/:id', auth(["admin", "customer"]), customerController.getCustomerById);

// Get all customers (admin)
router.get('/', auth(["admin"]), customerController.getAllCustomers);

// Delete customer
router.delete('/:id', auth(["admin", "customer"]), customerController.deleteCustomer);

module.exports = router;
