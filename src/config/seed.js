require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const FinancialRecord = require('../models/record.model');
const AuditLog = require('../models/audit.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance_dashboard';

const users = [
  { name: 'Super Admin',   email: 'admin@finance.com',   password: 'admin123',   role: 'admin',   status: 'active' },
  { name: 'Priya Analyst', email: 'analyst@finance.com', password: 'analyst123', role: 'analyst', status: 'active' },
  { name: 'Rahul Viewer',  email: 'viewer@finance.com',  password: 'viewer123',  role: 'viewer',  status: 'active' },
];

const categories = {
  income:  ['salary', 'freelance', 'investment', 'rental'],
  expense: ['food', 'transport', 'utilities', 'healthcare', 'entertainment', 'shopping', 'education'],
};

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(daysBack = 365) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d;
}

const descriptions = [
  'Monthly payment', 'Q2 bonus', 'Client project', 'Regular expense',
  'Annual renewal', 'One-time purchase', 'Recurring subscription', 'Emergency cost',
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('🔌 Connected to MongoDB');

  // Clear existing data
  await Promise.all([User.deleteMany(), FinancialRecord.deleteMany(), AuditLog.deleteMany()]);
  console.log('🗑  Cleared existing data');

  // Create users
  const createdUsers = [];
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12);
    const user = await User.create({ ...u, password: hashed });
    createdUsers.push(user);
    console.log(`👤 Created user: ${u.email} [${u.role}]`);
  }

  const adminUser = createdUsers[0];
  const analystUser = createdUsers[1];

  // Create 60 financial records
  const records = [];
  for (let i = 0; i < 60; i++) {
    const type = Math.random() > 0.4 ? 'expense' : 'income';
    const catList = categories[type];
    const category = catList[Math.floor(Math.random() * catList.length)];
    const amount = type === 'income'
      ? randomBetween(5000, 150000)
      : randomBetween(200, 25000);

    records.push({
      amount,
      type,
      category,
      date: randomDate(180),
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      tags: [type, category],
      createdBy: Math.random() > 0.5 ? adminUser._id : analystUser._id,
    });
  }

  await FinancialRecord.insertMany(records);
  console.log(`💰 Created ${records.length} financial records`);

  // Seed some audit logs
  await AuditLog.create([
    {
      actor: { userId: adminUser._id, name: adminUser.name, email: adminUser.email, role: 'admin' },
      action: 'LOGIN_SUCCESS',
      target: { resourceType: 'User', resourceId: adminUser._id, resourceLabel: adminUser.email },
      summary: `${adminUser.name} logged in successfully`,
      context: { ip: '127.0.0.1', userAgent: 'Seeder/1.0', requestId: 'seed-001', method: 'POST', endpoint: '/api/auth/login' },
      risk: { score: 0, level: 'low', flags: [] },
      status: 'success',
    },
    {
      actor: { userId: adminUser._id, name: adminUser.name, email: adminUser.email, role: 'admin' },
      action: 'ROLE_CHANGED',
      target: { resourceType: 'User', resourceId: analystUser._id, resourceLabel: analystUser.email },
      diff: { before: { role: 'viewer' }, after: { role: 'analyst' }, changedFields: ['role'] },
      summary: `${adminUser.name} changed role of "${analystUser.email}" from viewer to analyst`,
      context: { ip: '127.0.0.1', userAgent: 'Seeder/1.0', requestId: 'seed-002', method: 'PATCH', endpoint: '/api/users/role' },
      risk: { score: 35, level: 'medium', flags: ['role_escalation'] },
      status: 'success',
    },
  ]);
  console.log('📋 Created seed audit logs');

  console.log('\n✅ Seeding complete!\n');
  console.log('🔑 Test Credentials:');
  console.log('   Admin:   admin@finance.com   / admin123');
  console.log('   Analyst: analyst@finance.com / analyst123');
  console.log('   Viewer:  viewer@finance.com  / viewer123');
  console.log('\n📚 API Docs: http://localhost:5000/api/docs\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
