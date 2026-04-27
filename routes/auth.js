const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

router.get('/main', (req, res) => res.render('main'));

router.get('/login', (req, res) => res.render('login'));

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT * FROM show_coordinator WHERE email = ?', [email]
    );
    if (!rows.length) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }
    const user = rows[0];
    // Support both bcrypt-hashed and plaintext passwords (for seeded data)
    const match = user.reg_password.startsWith('$2')
      ? await bcrypt.compare(password, user.reg_password)
      : password === user.reg_password;
    if (!match) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }
    req.session.user = {
      id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.reg_role,
    };
    res.redirect(user.reg_role === 'developer' ? '/admin' : '/myshows');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error. Please try again.');
    res.redirect('/login');
  }
});

router.get('/register', (req, res) => res.render('register'));

router.post('/register', async (req, res) => {
  const { first_name, last_name, email, phone_number, password, role } = req.body;
  try {
    const [existing] = await db.query(
      'SELECT user_id FROM show_coordinator WHERE email = ?', [email]
    );
    if (existing.length) {
      req.flash('error', 'An account with that email already exists.');
      return res.redirect('/register');
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO show_coordinator (first_name, last_name, email, phone_number, reg_password, reg_role) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, phone_number, hashed, role]
    );
    req.flash('success', 'Account created! Please sign in.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/register');
  }
});

router.get('/passwordreset', (req, res) => res.render('passwordreset'));

router.post('/passwordreset', async (req, res) => {
  const { email, new_password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT user_id FROM show_coordinator WHERE email = ?', [email]
    );
    if (!rows.length) {
      req.flash('error', 'No account found with that email.');
      return res.redirect('/passwordreset');
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE show_coordinator SET reg_password = ? WHERE email = ?', [hashed, email]
    );
    req.flash('success', 'Password updated. Please log in.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Reset failed. Try again.');
    res.redirect('/passwordreset');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/main'));
});

module.exports = router;
