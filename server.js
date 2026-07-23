require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { hashPassword, comparePassword, generateToken, authMiddleware, optionalAuth, adminOnly } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load data
let users = store.load('users');
let services = store.load('services');
let bookings = store.load('bookings');

// Seed services if empty
if (services.length === 0) {
  services = [
    { id: 's1', name: 'Ride - Downtown', category: 'rideshare', price: 5.00, description: 'Quick ride anywhere downtown', provider: 'QuickRide', active: true },
    { id: 's2', name: 'Local Delivery', category: 'delivery', price: 8.00, description: 'Deliver anything locally', provider: 'QuickRide', active: true },
    { id: 's3', name: 'Handyman Task', category: 'tasks', price: 45.00, description: 'General handyman work per hour', provider: 'QuickRide Pro', active: true },
    { id: 's4', name: 'House Cleaning', category: 'tasks', price: 35.00, description: 'Professional house cleaning per hour', provider: 'QuickRide Pro', active: true }
  ];
  store.save('services', services);
}

// Seed admin if empty
if (users.length === 0) {
  users.push({
    id: crypto.randomUUID(),
    email: '',
    phone: '',
    password: hashPassword('admin123'),
    role: 'admin',
    created: Date.now()
  });
  store.save('users', users);
}

// --- AUTH ---

app.post('/api/auth/register', (req, res) => {
  const { email, name, password, phone } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });

  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    phone: phone || '',
    password: hashPassword(password),
    role: 'user',
    created: Date.now()
  };
  users.push(user);
  store.save('users', users);

  const token = generateToken(user);
  const { password: _, ...safe } = user;
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
  const { password: _, ...safe } = user;
  res.json({ user: safe, token });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

// --- SERVICES ---

app.get('/api/services', (req, res) => {
  const category = req.query.category;
  let list = services.filter(s => s.active);
  if (category) list = list.filter(s => s.category === category);
  res.json(list);
});

// --- BOOKINGS (auth required) ---

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
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
  booking.status = 'cancelled';
  booking.cancelledAt = Date.now();
  store.save('bookings', bookings);
  res.json(booking);
});

// --- ADMIN (admin only) ---

app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const revenue = active.reduce((sum, b) => sum + b.price, 0);
  res.json({
    users: users.length,
    services: services.length,
    bookings: active.length,
    revenue: revenue.toFixed(2),
    commission: (revenue * 0.10).toFixed(2),
    recentBookings: bookings.sort((a, b) => b.created - a.created).slice(0, 10)
  });
});

app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const safe = users.map(({ password, ...u }) => u);
  res.json(safe);
});

// --- HEALTH ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', services: services.length, users: users.length, bookings: bookings.length, uptime: process.uptime() });
});

// --- PAGES ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));

app.listen(PORT, () => console.log('QuickRide running on port ' + PORT));
