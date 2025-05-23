const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const pool = require('./config/db.js');
const redis = require('./config/redis.js');
// Initialize app
const app = express();
app.use(cors());

// Middleware
app.use(express.json());

// // Routes
app.use('/api/customers', require('./routes/Customer.js'));
app.use("/api/admins", require("./routes/Admin.js"));
app.use('/api/cars', require('./routes/Car.js'));
app.use('/api/workshops', require('./routes/Workshop.js'));
app.use('/api/services', require('./routes/Service.js'));
app.use('/api/bookings', require('./routes/Booking.js'));
app.use('/api/reviews', require('./routes/Review.js'));

// Default route
app.get('/', (req, res) => {
  res.send('Car Service API is running 🚗🛠️');
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
