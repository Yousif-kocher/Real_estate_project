const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = (req, res) => {
  const { fullname, email, password } = req.body;
  const photo = req.file ? req.file.filename : null;

  // Check if user exists
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) return res.status(400).json({ error: 'User already exists' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    db.query(
      'INSERT INTO users (fullname, email, password, photo) VALUES (?, ?, ?, ?)',
      [fullname, email, hashedPassword, photo],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const token = jwt.sign({ id: results.insertId }, process.env.JWT_SECRET || 'your-secret-key');
        res.json({ 
          message: 'User registered successfully', 
          token,
          user: { id: results.insertId, fullname, email, photo }
        });
      }
    );
  });
};

const login = (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your-secret-key');
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, fullname: user.fullname, email: user.email, photo: user.photo }
    });
  });
};

module.exports = { register, login };