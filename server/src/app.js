import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

import { runRecurring } from './services/recurring.js';

import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import udhaarRoutes from './routes/udhaar.js';
import budgetRoutes from './routes/budgets.js';
import reportRoutes from './routes/reports.js';
import insightRoutes from './routes/insights.js';
import tipRoutes from './routes/tips.js';
import notificationRoutes from './routes/notifications.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The Express app on its own, shared by the local server (index.js) and the
// Vercel function (api/index.mjs).
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health-check', (req, res) => res.json({ ok: true }));

// Vercel Cron calls this daily to write due recurring transactions for everyone.
app.get('/api/cron/daily', async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const created = await runRecurring();
    res.json({ ok: true, created: created.length });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/udhaar', udhaarRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

// Locally the built React app is served by Express. On Vercel the static files
// are served by the CDN and never reach this function.
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Central error handler - every route reaches this through the `wrap` helper.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'That record already exists';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Internal server error' : message });
});

export default app;
