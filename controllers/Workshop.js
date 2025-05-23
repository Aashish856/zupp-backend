const db = require('../config/db');
const crypto = require('crypto');
const redis = require('../config/redis');
const CACHE_KEYS = {
  ALL_WORKSHOPS: 'workshops:all',
  WORKSHOP_BY_ID: (id) => `workshops:${id}`,
};

const CACHE_CONFIG = {
  TTL_ONE_HOUR: 24*3600,
  TTL_FIVE_MINUTES: 300,
};

exports.registerWorkshop = async (req, res) => {
  try {
    const { phone_number, name, longitude, latitude, address } = req.body;
    if (!name || !phone_number || longitude === undefined || latitude === undefined || address === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const cachedWorkshops = await redis.get(CACHE_KEYS.ALL_WORKSHOPS);
    if (cachedWorkshops) {
      const workshops = JSON.parse(cachedWorkshops);
      const existingWorkshop = workshops.find(workshop => workshop.phone_number === phone_number);
      if (existingWorkshop) {
        return res.status(400).json({ message: 'Workshop already registered with this number' });
      }
    }
    const [existingWorkshop] = await db.query('SELECT * FROM Workshop WHERE phone_number = ?', [phone_number]);
    if (existingWorkshop.length > 0) {
      return res.status(400).json({ message: 'Workshop already registered with this number' });
    }
    const id = crypto.randomBytes(8).toString('hex');
    await db.query(
      'INSERT INTO Workshop (id, name, phone_number, longitude, latitude, status, is_active, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, phone_number, longitude, latitude, 'Acquired', true, address]
    );
    const [workshop] = await db.query('SELECT * FROM Workshop WHERE id = ?', [id]);
    // Invalidate caches
    await redis.del(CACHE_KEYS.ALL_WORKSHOPS);
    res.status(201).json(workshop[0]);
  } catch (err) {
    console.error('Error registering workshop:', err);
    res.status(500).json({ message: 'Failed to register workshop' });
  }
};

exports.getWorkshopById = async (req, res) => {
  try {
    const { id } = req.params;
    if(!id) return res.status(400).json({ message: 'Workshop ID is required' });

    const cacheKey = CACHE_KEYS.WORKSHOP_BY_ID(id);
    const cachedWorkshop = await redis.get(cacheKey);
    if (cachedWorkshop) {
      return res.status(200).json(JSON.parse(cachedWorkshop));
    }

    const [workshops] = await db.query('SELECT * FROM Workshop WHERE id = ?', [id]);
    if (workshops.length === 0) {
      return res.status(404).json({ message: 'Workshop not found' });
    }

    await redis.set(cacheKey, JSON.stringify(workshops[0]), 'EX', CACHE_CONFIG.TTL_ONE_HOUR);
    res.status(200).json(workshops[0]);

  } catch (err) {
    console.error('Error fetching workshop:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllWorkshops = async (req, res) => {
  try {
    const cachedWorkshops = await redis.get(CACHE_KEYS.ALL_WORKSHOPS);
    if (cachedWorkshops) {
      return res.status(200).json(JSON.parse(cachedWorkshops));
    }

    const [workshops] = await db.query('SELECT * FROM Workshop WHERE is_active = TRUE');
    await redis.set(CACHE_KEYS.ALL_WORKSHOPS, JSON.stringify(workshops), 'EX', CACHE_CONFIG.TTL_ONE_HOUR);
    res.status(200).json(workshops);

  } catch (err) {
    console.error('Error fetching workshops:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateWorkshop = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Workshop ID is required' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields provided for update' });
    }

    // Build dynamic query string and values array
    const fields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    const [result] = await db.query(
      `UPDATE Workshop SET ${fields} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Workshop not found' });
    }

    const [workshops] = await db.query('SELECT * FROM Workshop WHERE id = ?', [id]);
    const updatedWorkshop = workshops[0];

    // Invalidate relevant cache keys
    await redis.del(CACHE_KEYS.ALL_WORKSHOPS);
    await redis.del(CACHE_KEYS.WORKSHOP_BY_ID(id));

    res.status(200).json({ message: 'Workshop updated successfully', workshop: updatedWorkshop });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
