const db = require('../config/db');
const crypto = require('crypto');
const redis = require('../config/redis');

// Create a new review
exports.createReview = async (req, res) => {
  try {
    const { booking_id, rating, review } = req.body;

    if (!booking_id || !rating || !review) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existingBookings] = await db.query('SELECT * FROM Booking WHERE id = ?', [booking_id]);
    if (existingBookings.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const id = crypto.randomBytes(8).toString('hex');

    await db.query(
      'INSERT INTO Review (id, booking_id, rating, review) VALUES (?, ?, ?, ?)',
      [id, booking_id, rating, review]
    );

    // Invalidate Redis cache for this service_id
    const service_id = existingBookings[0].service_id;
    await redis.del(`reviews:${service_id}`);

    const [newReview] = await db.query('SELECT * FROM Review WHERE id = ?', [id]);

    res.status(201).json(newReview[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to submit review' });
  }
};

// Get reviews by service_id
exports.getReviewsByServiceId = async (req, res) => {
  try {
    const { service_id } = req.params;

    // Check Redis cache first
    const cachedReviews = await redis.get(`reviews:${service_id}`);
    if (cachedReviews) {
      return res.status(200).json(JSON.parse(cachedReviews));
    }

    const [bookings] = await db.query('SELECT id FROM Booking WHERE service_id = ?', [service_id]);
    const bookingIds = bookings.map(b => b.id);

    if (bookingIds.length === 0) {
      return res.status(200).json([]); // No bookings, no reviews
    }

    const [reviews] = await db.query(
      `SELECT * FROM Review WHERE booking_id IN (${bookingIds.map(() => '?').join(',')})`,
      bookingIds
    );

    // Cache the result
    await redis.set(`reviews:${service_id}`, JSON.stringify(reviews));

    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get review by booking_id
exports.getReviewByBookingId = async (req, res) => {
  try {
    const { booking_id } = req.params;

    const [reviews] = await db.query('SELECT * FROM Review WHERE booking_id = ?', [booking_id]);

    if (reviews.length === 0) {
      return res.status(404).json({ message: 'No review found for this booking' });
    }

    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete review by review id
exports.deleteReviewById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the review first
    const [existingReview] = await db.query('SELECT * FROM Review WHERE id = ?', [id]);
    if (existingReview.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const booking_id = existingReview[0].booking_id;

    // Find service_id for this booking
    const [booking] = await db.query('SELECT * FROM Booking WHERE id = ?', [booking_id]);
    if (booking.length === 0) {
      return res.status(404).json({ message: 'Associated booking not found' });
    }

    const service_id = booking[0].service_id;

    // Delete review
    await db.query('DELETE FROM Review WHERE id = ?', [id]);

    // Invalidate Redis cache for this service_id
    await redis.del(`reviews:${service_id}`);

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete review' });
  }
};
