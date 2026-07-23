require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- In-memory stores (replace with DB later) ---
const users = new Map();
const services = new Map();
const bookings = new Map();
const payments = new Map();

// Seed some initial services
services.set('s1', { id: 's1', name: 'Ride - Downtown', category: 'rideshare', price: 5.00, description: 'Quick ride downtown', provider: 'QuickRide', active: true });
services.set('s2', { id: ''', provider: s3s3', name: 'Handyman Task', category: 'tasks', price: 45.00, description: 'General handyman work (per hour)', provider: 'QuickRide Pro', active: true });
services.set('s4''House Cleaning

// --- Auth helpers ---
function hashPassword(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// --- API Routes ---

// Get all services
app.get('/api/services', (req, res) => {
  const category = req.query.category;
  let list = Array.from(services.values()).filter(s => s.active);
  if (category) list = list.filter(s => s.category === category);
  res.json(list);
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, name, password, phone } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Missing fields' });
  if (users.has(email)) return res.status(409).json({ error: 'Email taken' });
  
  const user = {
    id: crypto.randomUUID(),
    email, name, phone: phone || '',
    password: hashPassword(password),
    role: 'user',
    created: Date.now()
  };
  users.set(email, user);
  
  const token = generateToken();
  const { password: _, ...safe } = user;
  res.status(201).json({ user: safe, token });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken();
  const { password: _, ...safe } = user;
  res.json({ user: safe, token });
});

// Create booking
app.post('/api/bookings', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Auth required' });
  
  const { serviceId, address, notes, scheduledTime } = req.body;
  const service = services.get(serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  
  const booking = {
    id: crypto.randomUUID(),
    serviceId,
    serviceName: service.name,
    category: service.category,
    price: service.price,
    address: address || '',
    notes: notes || '',
    scheduledTime: scheduledTime || null,
    status: 'pending',
    created: Date.now()
  };
  
  bookings.set(booking.id, booking);
  res.status(201).json(booking);
});

// Get user bookings
app.get('/api/bookings', (req, res) => {
  const list = Array.from(bookings.values()).sort((a, b) => b.created - a.created);
  res.json(list);
});

// Cancel booking
app.patch('/api/bookings/:id/cancel', (req, res) => {
  const booking = bookings.get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  booking.status = 'cancelled';
  res.json(booking);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: services.size,
    users: users.size,
    bookings: bookings.size,
    uptime: process.uptime()
  });
});

// --- Stripe Payment Intent ---
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, bookingId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      metadata: { bookingId }
    });
    
    payments.set(paymentIntent.id, {
      id: paymentIntent.id,
      bookingId,
      amount,
      status: 'pending',
      created: Date.now()
    });
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin Routes ---
app.get('/api/admin/stats', (req, res) => {
  const totalBookings = bookings.size;
  const activeBookings = Array.from(bookings.values()).filter(b => b.status !== 'cancelled').length;
  const revenue = Array.from(bookings.values())
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.price, 0);
  
  res.json({
    users: users.size,
    services: services.size,
    bookings: totalBookings,
    activeBookings,
    revenue: revenue.toFixed(2),
    commission: (revenue * 0.10).toFixed(2)
  });
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`QuickRide running on port ${PORT}`);
});
