const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/Review.js');
const auth = require('../middlewares/Auth.js');

// Create a new review (customer only)
router.post('/', auth(['customer']), reviewController.createReview);

// Get all reviews for a specific service
router.get('/service/:service_id', reviewController.getReviewsByServiceId);

// Get a review by booking ID
router.get('/booking/:booking_id', reviewController.getReviewByBookingId);

// Delete a review by review ID (customer only)
router.delete('/:id', auth(['customer']), reviewController.deleteReviewById);

module.exports = router;
