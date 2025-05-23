const crypto = require("crypto");
const db = require("../config/db");
const redis = require("../config/redis");

const formatServiceData = (service) => {
  if (service.features) service.features = JSON.parse(service.features);
  if (service.details) service.details = JSON.parse(service.details);
  return service;
};

exports.createBooking = async (req, res) => {
  try {
    const user = req.user;
    const {car_id, service_id, booking_date, pickup_address, pickup_timing, longitude, latitude} = req.body;

    if (
      !car_id ||
      !service_id ||
      !booking_date ||
      !pickup_address ||
      !pickup_timing ||
      longitude === undefined ||
      latitude === undefined
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let cachedServices = await redis.get("services");
    if (!cachedServices) {
      const [services] = await db.query("SELECT * FROM Service");
      services.forEach(formatServiceData);
      await redis.set("services", JSON.stringify(services), "EX", 7*243600);
      cachedServices = JSON.stringify(services);
    }
    const services = JSON.parse(cachedServices);
    const service = services.find((s) => s.id === service_id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    console.log(service)
    const total_amount = Number(service.price) + 100;
    console.log(total_amount)
    const id = crypto.randomBytes(8).toString("hex");
    const newBooking = {
        id,
        total_amount,
        customer_id: user.id,
        car_id,
        service_id,
        status: "Pending",
        booking_date,
        pickup_address,
        pickup_timing,
        longitude,
        latitude,
        workshop_id: null
    };
    await db.query(
      `INSERT INTO Booking 
        (id, total_amount, customer_id, car_id, service_id, status, booking_date, pickup_address, pickup_timing, longitude, latitude) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        total_amount,
        user.id,
        car_id,
        service_id,
        "Pending",
        booking_date,
        pickup_address,
        pickup_timing,
        longitude,
        latitude
      ]
    );
    await redis.del(`customer:bookings:${user.id}`);
    res.status(201).json({
      message: "Booking created successfully",
      booking: newBooking
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getBookingsByCustomer = async (req, res) => {
  try {
    const user = req.user;
    const { customerId } = req.params;

    // Access control
    if (user.role !== "admin" && user.id !== customerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const cacheKey = `customer:bookings:${customerId}`;
    const cachedBookings = await redis.get(cacheKey);

    if (cachedBookings) {
      return res.status(200).json(JSON.parse(cachedBookings));
    }

    // Fresh DB query
    const [bookings] = await db.query(
      `SELECT 
        -- Booking fields
        b.id AS booking_id,
        b.customer_id AS booking_customer_id,
        b.car_id AS booking_car_id,
        b.workshop_id AS booking_workshop_id,
        b.service_id AS booking_service_id,
        b.status AS booking_status,
        b.booking_date,
        b.pickup_address,
        b.pickup_timing,
        b.longitude AS booking_longitude,
        b.latitude AS booking_latitude,
        b.total_amount,
        b.created_at AS booking_created_at,
        b.updated_at AS booking_updated_at,

        -- Customer fields
        cu.id AS customer_id,
        cu.phone_number AS customer_phone_number,
        cu.name AS customer_name,

        -- Car fields
        c.registration_number AS car_registration_number,
        c.brand AS car_brand,
        c.model AS car_model,

        -- Service fields
        s.id AS service_id,
        s.category AS service_category,
        s.name AS service_name,

        -- Workshop fields
        w.id AS workshop_id,
        w.name AS workshop_name,
        w.address AS workshop_address

      FROM Booking b
      JOIN Customer cu ON b.customer_id = cu.id
      JOIN Car c ON b.car_id = c.id
      JOIN Service s ON b.service_id = s.id
      LEFT JOIN Workshop w ON b.workshop_id = w.id
      WHERE b.customer_id = ?`,
      [customerId]
    );

    await redis.set(cacheKey, JSON.stringify(bookings), "EX", 1.5*24*3600);
    res.status(200).json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};