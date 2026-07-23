require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { hashPassword, comparePassword, generateToken, generateResetToken, authMiddleware, adminOnly } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load data
let users = store.load('users');
let services = store.load('services');
let bookings = store.load('bookings');
let resetTokens = store.load('resets') || [];

// Seed services
if (services.length === 0) {
  services = [
    { id: 's1', name: 'Ride - Downtown', category: 'rideshare', price: 5.00, description: 'Quick ride anywhere downtown', provider: 'QuickRide', active: true },
    { id: 's2', name: 'Local Delivery', category: 'delivery', price: 8.00, description: 'Deliver anything locally', provider: 'QuickRide', active: true },
    { id: 's3', name: 'Handyman Task', category: 'tasks, active: true },'
  store.save(admin@quickride.app
    phone: 
    password: hashPassword('admin123'),
    securityQuestion: 'What is your favorite color?',
    securityAnswer: hashPassword('blue'),
    role: 'admin',
    created: Date.now()
  });
  store.save('users', users);
}

// ============ AUTH ============

app.post('/api/auth/register', (req, res) => {
  const { email, name, password, phone, securityQuestion, securityAnswer } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (users.find(u => u.email === email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });

  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    phone: phone || '',
    password: hashPassword(password),
    securityQuestion: securityQuestion || 'What is your favorite color?',
    securityAnswer: securityAnswer ? hashPassword(securityAnswer.toLowerCase()) : hashPassword('blue'),
    role: 'user',
    created: Date.now()
  };
  users.push(user);
  store.save('users', users);

  const token = generateToken(user);
  const { password: _, securityAnswer: __, ...safe } = user;
  res.status(201).json({ user: safe, token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = users.find(u => u.email === email.toLowerCase());
  if (!user || !comparePassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  const { password: _, securityAnswer: __, ...safe } = user;
  res.json({ user: safe, token });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, securityAnswer: __, ...safe } = user;
  res.json(safe);
});

// ============ PASSWORD RECOVERY ============

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account found with that email' });

  const resetToken = generateResetToken();
  resetTokens.push({
    token: resetToken,
    email: user.email,
    expires: Date.now() + 3600000, // 1 hour
    used: false
  });
  store.save('resets', resetTokens);

  const { securityAnswer: _, password: __, ...safe } = user;
  res.json({
    email: user.email,
    securityQuestion: user.securityQuestion || 'What is your favorite color?',
    resetToken
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { resetToken, email, securityAnswer, newPassword } = req.body;
  if (!resetToken || !email || !securityAnswer || !newPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const reset = resetTokens.find(r => r.token === resetToken && r.email === email.toLowerCase() && !r.used && r.expires > Date.now());
  if (!reset) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!comparePassword(securityAnswer.toLowerCase(), user.securityAnswer)) {
    return res.status(401).json({ error: 'Incorrect security answer' });
  }

  user.password = hashPassword(newPassword);
  reset.used = true;
  store.save('users', users);
  store.save('resets', resetTokens);

  res.json({ message: 'Password reset successful' });
});

// ============ SERVICES ============

app.get('/api/services', (req, res) => {
  const category = req.query.category;
  let list = services.filter(s => s.active);
  if (category) list = list.filter(s => s.category === category);
  res.json(list);
});

// ============ BOOKINGS ============

app.post('/api/bookings', authMiddleware, (req, res) => {
  const { serviceId, address, notes } = req.body;
  const service = services.find(s => s.id === serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const booking = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    serviceId,
    serviceName: service.name,
    category: service.category,
    price: service.price,
    address: address || '',
    notes: notes || '',
    status: 'pending',
    created: Date.now()
  };
  bookings.push(booking);
  store.save('bookings', bookings);
  res.status(201).json(booking);
});

app.get('/api/bookings', authMiddleware, (req, res) => {
  const userBookings = bookings
    .filter(b => b.userId === req.user.id)
    .sort((a, b) => b.created - a.created);
  res.json(userBookings);
});

app.patch('/api/bookings/:id/cancel', authMiddleware, (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id && b.userId === req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.status = 'cancelled';
  store.save('bookings', bookings);
  res.json(booking);
});

// ============ ADMIN ============

app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const revenue = active.reduce((sum, b) => sum + b.price, 0);
  res.json({ users: users.length, services: services.length, bookings: active.length, revenue: revenue.toFixed(2), commission: (revenue * 0.10).toFixed(2) });
});

// ============ HEALTH ============

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', services: services.length, users: users.length, bookings: bookings.length });
});

// ============ PAGES ============

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));

app.listen(PORT, () => console.log('QuickRide running on port ' + PORT));
