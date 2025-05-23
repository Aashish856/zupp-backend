const express = require('express');
const router = express.Router();
const workshopController = require('../controllers/Workshop.js');
const auth = require('../middlewares/Auth.js');

// @route   POST /api/workshops
// @desc    Register a new workshop
router.post('/register', auth(["admin"]),  workshopController.registerWorkshop);

// @route   GET /api/workshops/:id
// @desc    Get workshop by ID
router.get('/:id', auth(["admin"]), workshopController.getWorkshopById);

// @route   GET /api/workshops
// @desc    Get all active workshops
router.get('/', auth(["admin"]), workshopController.getAllWorkshops);

// @route   PUT /api/workshops/:id/status
// @desc    Update workshop status (Acquired, In-Progress, Rejected)
router.put('/:id', auth(["admin"]), workshopController.updateWorkshop);

module.exports = router;
