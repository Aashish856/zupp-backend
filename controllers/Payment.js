const redis = require('../config/redis');  // assuming your redis client is here
const db = require('../config/db');
const crypto = require('crypto');
  const crypto = require('crypto');
  const redis = require('../config/redis');
  const db = require('../config/db');
  const { createBooking } = require('./Booking'); // assuming you have a separate controller for bookings
  
  exports.createPayment = async (req, res) => {
    try {
      const user = req.user;
      const { service_id, car_id, booking_date, pickup_address, pickup_timing, longitude, latitude, payment_method } = req.body;
  
      if (!service_id || !car_id || !booking_date || !pickup_address || !pickup_timing || longitude === undefined || latitude === undefined || !payment_method) {
        return res.status(400).json({ message: 'All fields are required' });
      }
  
      // Fetch services from Redis
      let cachedServices = await redis.get('services');
      if (!cachedServices) {
        const [services] = await db.query('SELECT * FROM Service');
        services.forEach(service => formatServiceData(service));
        await redis.set('services', JSON.stringify(services), 'EX', 3600);
        cachedServices = JSON.stringify(services);
      }
  
      const services = JSON.parse(cachedServices);
      const service = services.find(s => s.id === service_id);
  
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
  
      const base_price = service.price;
      const convenience_fee = 100;
      const total_amount = base_price + convenience_fee;
  
      const payment_id = crypto.randomBytes(8).toString('hex');
  
      // Create the payment record
      await db.query(
        'INSERT INTO Payment (id, payment_mode, base_price, convenience_charges, status) VALUES (?, ?, ?, ?, ?)',
        [payment_id, payment_method, base_price, convenience_fee, 'not-paid']
      );
  
      // After payment is created, call the createBooking function
      const bookingResponse = await createBooking(req, res, payment_id);
  
      // Respond with the success message
      if (bookingResponse.status !== 201) {
        return res.status(500).json({ message: 'Failed to create booking' });
      }
      res.status(201).json({
        message: 'Booking created successfully',
        booking: bookingResponse.booking,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to create payment and booking' });
    }
  };

exports.calculateCharges = async (req, res) => {
  try {
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({ message: 'Service ID is required' });
    }

    // Fetch services from Redis
    const cachedServices = await redis.get('services');

    if (!cachedServices) {
        const [services] = await db.query('SELECT * FROM Service');
        services.forEach(service => formatServiceData(service));
        await redis.set('services', JSON.stringify(services), 'EX', 3600);  // Cache for 1 hour
    }

    const services = JSON.parse(cachedServices);
    const service = services.find(s => s.id === service_id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const base_price = service.price;
    const convenience_fee = 100;

    res.status(200).json({
      base_price,
      convenience_fee
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


