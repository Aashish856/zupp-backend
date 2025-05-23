const express = require('express');
const router = express.Router();
const carController = require('../controllers/Car.js');
const auth = require('../middlewares/Auth.js');

// @route   POST /api/cars
// @desc    Register a new car
router.post('/', auth(["customer"]), carController.registerCar);

// @route   GET /api/cars/:id
// @desc    Get car by ID
router.get('/:id', auth(["admin", "customer"]), carController.getCarById);

// @route   GET /api/cars/customer/:customerId
// @desc    Get all cars for a specific customer
router.get('/customer/:customerId', auth(["admin", "customer"]), carController.getCarsByCustomer);

// @route   DELETE /api/cars/:id
// @desc    Delete a car by ID
router.delete('/:id', auth(["customer"]), carController.deleteCar);

// @route   PUT /api/cars/:id
// @desc    Update car details
router.put('/:id', auth(["customer"]), carController.updateCar);

module.exports = router;