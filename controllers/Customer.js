const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const crypto = require('crypto');
const sendOTP = require('../utils/sendotp');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

const sendOtp = async (phone_number) => {
  // const otp = Math.floor(100000 + Math.random() * 900000);
  const otp = "123456"
  const otpKey = `otp:${phone_number}`;
  const requestCountKey = `otp_requests_count:${phone_number}`;
  
  const timeWindow = 7200;
  const maxRequests = 100;
  
  try {
    const requestCount = await redis.get(requestCountKey);
    if (requestCount && parseInt(requestCount) >= maxRequests) {
      return { success: false, error: "Rate limit exceeded. Try again later." };
    }
    await redis.multi().incr(requestCountKey).expire(requestCountKey, timeWindow).exec();
    
    await redis.del(otpKey);
    const ress = await redis.set(otpKey, otp, 'EX', 300);
    return { success: true, otp };
  } catch (error) {
    await redis.del(otpKey);
    console.error('Error sending OTP:', error);
    return { success: false, error };
  }
};

// Registration: Send OTP
exports.sendRegisterOtp = async (req, res) => {
  try {
    if(!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number, name } = req.body;
    if (!phone_number || !name) {
      return res.status(400).json({ message: 'Phone number and name are required' });
    }

    const [existingCustomers] = await db.query('SELECT * FROM Customer WHERE phone_number = ?', [phone_number]);
    // console.log(existingCustomers)
    if (existingCustomers.length > 0) {
      return res.status(400).json({ message: 'Customer already exists' });
    }

    const otpResponse = await sendOtp(phone_number);
    
    if (!otpResponse.success) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    await redis.set(`pending_customer:${phone_number}`, name, 'EX', 300);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Registration: Verify OTP and create account
exports.verifyRegisterOtp = async (req, res) => {
  try {
    if(!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const storedOtp = await redis.get(`otp:${phone_number}`);

    if (storedOtp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const name = await redis.get(`pending_customer:${phone_number}`);
    if (!name) {
      return res.status(400).json({ message: 'Registration session expired' });
    }

    const id = crypto.randomBytes(8).toString('hex');
    await db.query(
      'INSERT INTO Customer (id, phone_number, name) VALUES (?, ?, ?)',
      [id, phone_number, name]
    );

    await redis.del(`otp:${phone_number}`);
    await redis.del(`pending_customer:${phone_number}`);

    const token = jwt.sign({ id: id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Registered succesfully',
      token,
      customer: { id: id, phone_number: phone_number, name: name }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login: Send OTP
exports.sendLoginOtp = async (req, res) => {
  try {
    if(!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }


    const [customers] = await db.query('SELECT * FROM Customer WHERE phone_number = ?', [phone_number]);
    

    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const otpResponse = await sendOtp(phone_number);
    if (!otpResponse.success) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Login: Verify OTP and generate token
exports.verifyLoginOtp = async (req, res) => {
  try {
    if(!req.body) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const storedOtp = await redis.get(`otp:${phone_number}`);
    if (storedOtp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const [customers] = await db.query('SELECT * FROM Customer WHERE phone_number = ?', [phone_number]);
    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customer = customers[0];
    const token = jwt.sign({ id: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });

    await redis.del(`otp:${phone_number}`);
    res.status(200).json({
      message: 'Login successful',
      token,
      customer: { id: customer.id, phone_number: customer.phone_number, name: customer.name }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    if(!req.params) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'admin' && user.id !== id) {
      return res.status(403).json({ message: 'Request Forbidden' });
    }

    const [customers] = await db.query(
      'SELECT id, phone_number, name, created_at, updated_at FROM Customer WHERE id = ?',
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json(customers[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const [customers] = await db.query(
      'SELECT id, phone_number, name, created_at, updated_at FROM Customer'
    );
    res.status(200).json(customers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role !== 'admin' && user.id !== id) {
      return res.status(403).json({ message: 'Request Forbidden' });
    }

    const [result] = await db.query('DELETE FROM Customer WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
