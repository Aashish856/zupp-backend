const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db.js');
const redis = require('../config/redis');
const sendOTP = require('../utils/sendotp');

const JWT_SECRET = process.env.JWT_SECRET
const adminSecretPass = process.env.ADMIN_SECRET_PASS;

// Utility to send OTP with rate limit
const sendOtp = async (phone_number) => {
  const otp = Math.floor(100000 + Math.random() * 900000);
  const otpKey = `otp:admin:${phone_number}`;
  const requestCountKey = `otp_requests_count:admin:${phone_number}`;
  const timeWindow = 7200;
  const maxRequests = 10;

  try {
    const requestCount = await redis.get(requestCountKey);
    if (requestCount && parseInt(requestCount) >= maxRequests) {
      return { success: false, error: "Rate limit exceeded. Try again later." };
    }
    await redis.multi().incr(requestCountKey).expire(requestCountKey, timeWindow).exec();
    await redis.del(otpKey);
    await redis.set(otpKey, otp, 'EX', 300);
    await sendOTP(phone_number, otp);
    return { success: true, otp };
  } catch (error) {
    await redis.del(otpKey);
    console.error('Error sending OTP:', error);
    return { success: false, error };
  }
};

// Send OTP for admin registration
exports.sendRegisterOtp = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number, secretPass, name } = req.body;
    if (!phone_number || !secretPass) {
      return res.status(400).json({ message: 'Phone number, Name and secret password are required' });
    }
    if (secretPass !== adminSecretPass) {
      return res.status(400).json({ message: 'Invalid secret password' });
    }

    const [existingAdmins] = await db.query('SELECT * FROM Admin WHERE phone_number = ?', [phone_number]);
    if (existingAdmins.length > 0) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const otpResponse = await sendOtp(phone_number);
    if (!otpResponse.success) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }
    await redis.set(`pending_admin:${phone_number}`, name, 'EX', 300);
    res.status(200).json({ message: 'OTP sent successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify OTP and complete admin registration
exports.verifyRegisterOtp = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const name = await redis.get(`pending_admin:${phone_number}`);
    if (!name) {
      return res.status(400).json({ message: 'No pending registration found' });
    }

    const [existingAdmins] = await db.query('SELECT * FROM Admin WHERE phone_number = ?', [phone_number]);
    if (existingAdmins.length > 0) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const storedOtp = await redis.get(`otp:admin:${phone_number}`);
    if (!storedOtp || storedOtp !== otp.toString()) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    await redis.del(`otp:admin:${phone_number}`);

    const id = crypto.randomBytes(8).toString('hex');
    await db.query('INSERT INTO Admin (id, phone_number, name) VALUES (?, ?, ?)',
      [id, phone_number, name]);

    const token = jwt.sign({ id, role: "admin" }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Admin registered successfully',
      token,
      admin: { id, phone_number, name }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Send Login OTP
exports.sendLoginOtp = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const [admins] = await db.query('SELECT * FROM Admin WHERE phone_number = ?', [phone_number]);
    if (admins.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const otpResponse = await sendOtp(phone_number);
    if (!otpResponse.success) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    res.status(200).json({ message: 'OTP sent successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Verify Login OTP
exports.verifyLoginOtp = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const [admins] = await db.query('SELECT * FROM Admin WHERE phone_number = ?', [phone_number]);
    if (admins.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const storedOtp = await redis.get(`otp:admin:${phone_number}`);
    if (!storedOtp || storedOtp !== otp.toString()) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    await redis.del(`otp:admin:${phone_number}`);
    const admin = admins[0];
    const token = jwt.sign({ id: admin.id, role: "admin" }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        phone_number: admin.phone_number,
        name: admin.name
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get Admin by ID
exports.getAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const [admins] = await db.query('SELECT id, phone_number, name FROM Admin WHERE id = ?', [id]);
    if (admins.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.status(200).json(admins[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
