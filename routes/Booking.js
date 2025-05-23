const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/Booking.js');
const auth = require('../middlewares/Auth');

router.post('/', auth(["customer"]), bookingController.createBooking);

router.get('/customer/:customerId', auth(["customer", "admin"]), bookingController.getBookingsByCustomer);

// router.delete('/:id', auth(["admin"]), bookingController.deleteBooking);

// router.put('/:id', auth(["admin"]), bookingController.updateBooking);

module.exports = router;