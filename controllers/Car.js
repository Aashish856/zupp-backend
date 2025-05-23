const db = require('../config/db');
const crypto = require('crypto');
const redis = require('../config/redis');

function getCarDetail(reg_number) {
  return {
    brand: "Toyota",
    model: "Corolla"
  };
}

exports.registerCar = async (req, res) => {
  try {
    const user = req.user;

    if (!req.body || !req.body.registration_number) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { registration_number } = req.body;
    
    const [existingCars] = await db.query('SELECT * FROM Car WHERE registration_number = ? AND customer_id = ?', [registration_number, user.id]);
    if (existingCars.length > 0) {
      return res.status(400).json({ message: 'Car already registered with this number' });
    }
    
    const { brand, model } = getCarDetail(registration_number);
    const id = crypto.randomBytes(8).toString('hex');

    await db.query(
      'INSERT INTO Car (id, customer_id, registration_number, brand, model) VALUES (?, ?, ?, ?, ?)',
      [id, user.id, registration_number, brand, model]
    );
    await redis.del(`cars:${user.id}`);
    res.status(201).json({
      message: 'Car registered successfully',
      car: { id, customer_id: user.id, registration_number, brand, model }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCarById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    const cachedCar = await redis.get(`car:${id}`);

    if (cachedCar) {
      if (user.role !== 'admin' && user.id !== cachedCar.customer_id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      return res.status(200).json(JSON.parse(cachedCar));
    }

    const [cars] = await db.query('SELECT * FROM Car WHERE id = ?', [id]);

    if (cars.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const car = cars[0];

    await redis.set(`car:${id}`, JSON.stringify(car), 'EX', 3600);  // Cache for 1 hour

    if (user.role !== 'admin' && user.id !== car.customer_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCarsByCustomer = async (req, res) => {
  try {
    const user = req.user;
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }
    if (user.role !== 'admin' && user.id !== customerId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if the cars are cached for the customer
    const cachedCars = await redis.get(`cars:${customerId}`);

    if (cachedCars) {
      return res.status(200).json(JSON.parse(cachedCars));
    }
    const [cars] = await db.query('SELECT * FROM Car WHERE customer_id = ?', [customerId]);
    await redis.set(`cars:${customerId}`, JSON.stringify(cars), 'EX', 3600*24);  // Cache for 1 hour

    res.status(200).json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCar = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    const [car] = await db.query('SELECT * FROM Car WHERE id = ?', [id]);
    if (car.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }
    
    if(user.role !== 'admin' && user.id !== car[0].customer_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [result] = await db.query('DELETE FROM Car WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Invalidate the cached car data and customer cars list
    await redis.del(`car:${id}`);
    await redis.del(`cars:${car[0].customer_id}`);
    res.status(200).json({ message: 'Car deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCar = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No data provided for update' });
    }

    const fields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    const [car] = await db.query('SELECT * FROM Car WHERE id = ?', [id]);
    if(car.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }
    if(user.role !== 'admin' && user.id !== car[0].customer_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [result] = await db.query(`UPDATE Car SET ${fields} WHERE id = ?`, [...values, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const [updatedCar] = await db.query('SELECT * FROM Car WHERE id = ?', [id]);

    // Invalidate the cached car data and customer cars list
    await redis.del(`car:${id}`);
    await redis.del(`cars:${updatedCar[0].customer_id}`);  // Invalidate cache for customer cars

    res.status(200).json({ message: 'Car updated successfully', car: updatedCar[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
