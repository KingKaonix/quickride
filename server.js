require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const users = new Map();
const services = new Map();
const bookings = new Map();

services.set('s1', { id: 's1', name: 'Ride - Downtown', category: 'rideshare', price: 5.00, description: 'Quick ride anywhere downtown', provider: 'QuickRide', active: true });
services.set('s2', { id: 's2', name: 'Local Delivery', category: 'delivery', price: 8.00, description: 'Deliver anything locally', provider: 'QuickRide', active: true });
services.set('s3', { id: 's3', name: 'Handyman Task', category: 'tasks', price: 45.00, description: 'General handyman work per hour', provider: 'QuickRide Pro', active: true });
services.set('s4', { id: 's4', name: 'House Cleaning', category: 'tasks', price: 35.00, description: 'Professional house cleaning per hour', provider: 'QuickRide Pro', active: true });

function hashPassword(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

app.get('/api/services', (req, res) => {
  const category = req.query.category;
  let list = Array.from(services.values()).filter(s => s.active);
  if (category) list = list.filter(s => s.category === category);
  res.json(list);
});

app.post('/api/auth/register', (req, res) => {
  const { email, name, password, phone } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Missing fields' });
  if (users.has(email)) return res.status(409).json({ error: 'Email taken' });
  const user = { id: crypto.randomUUID(), email, name, phone: phone || '', password: hashPassword(password), role: 'user', created: Date.now() };
  users.set(email, user);
  const { password: _, ...safe } = user;
  res.status(201).json({ user: safe, token: generateToken() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user || user.password !== hashPassword(password)) return res.status(401).json({ error: 'Invalid credentials' });
  const { password: _, ...safe } = user;
  res.json({ user: safe, token: generateToken() });
});

app.post('/api/bookings', (req, res) => {
  const { serviceId, address, notes } = req.body;
  const service = services.get(serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const booking = { id: crypto.randomUUID(), serviceId, serviceName: service.name, category: service.category, price: service.price, address: address || '', notes: notes || '', status: 'pending', created: Date.now() };
  bookings.set(booking.id, booking);
  res.status(201).json(booking);
});

app.get('/api/bookings', (req, res) => {
  const list = Array.from(bookings.values()).sort((a, b) => b.created - a.created);
  res.json(list);
});

app.patch('/api/bookings/:id/cancel', (req, res) => {
  const booking = bookings.get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  booking.status = 'cancelled';
  res.json(booking);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', services: services.size, users: users.size, bookings: bookings.size, uptime: process.uptime() });
});

app.get('/api/admin/stats', (req, res) => {
  const active = Array.from(bookings.values()).filter(b => b.status !== 'cancelled');
  const revenue = active.reduce((sum, b) => sum + b.price, 0);
  res.json({ users: users.size, services: services.size, bookings: active.length, revenue: revenue.toFixed(2), commission: (revenue * 0.10).toFixed(2) });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

app.listen(PORT, () => console.log(`QuickRide running on port ${PORT}`));
