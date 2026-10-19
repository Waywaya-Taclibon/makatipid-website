require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const propertyRoutes = require('./routes/properties');
const rentalLogRoutes = require('./routes/rentallog');
const paymentRoutes = require('./routes/payments');
const propertyImageRoutes = require('./routes/propertyImages');
const messageRoutes = require('./routes/messages');
const healthRoutes = require('./routes/health');

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/nginx (rate limiting, logs)
const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

// In production, refuse plain HTTP when the site is served over HTTPS.
if (isProd && FRONTEND_ORIGIN.startsWith('https://')) {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    return next();
  });
}

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  })
);

// PayMongo webhook needs the raw body for signature verification, so it must
// be parsed as a Buffer BEFORE the global JSON parser runs. authMiddleware
// treats this path as public (no JWT); the webhook handler verifies the
// PayMongo signature instead.
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json());

// Brute-force / flood protection (Phase 2.7).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});
const paymentsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many payment requests. Please try again in a few minutes.' },
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Messaging uses its own limiters below: chat polling is frequent by design
  // and would otherwise blow through the global budget with a single thread open.
  skip: (req) => req.path.startsWith('/messages'),
  message: { message: 'Too many requests. Please slow down.' },
});
// Property creation is expensive (row + optional photo uploads), so it gets its
// own tighter limit. GET/PUT/DELETE on the same mount are skipped.
const propertyCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST' || req.path !== '/',
  message: { message: 'Too many property submissions. Please try again later.' },
});
// Chat reads are polled every few seconds, so they get a roomy budget; sends
// get a much tighter one to stop spam.
const messagesReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method !== 'GET',
  message: { message: 'Too many message requests. Please slow down.' },
});
const messagesSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: { message: 'Too many messages sent. Please wait a moment and try again.' },
});
app.use('/api/auth', authLimiter);
app.use('/api/payments', paymentsLimiter);
app.use('/api/properties', propertyCreateLimiter);
app.use('/api/messages', messagesReadLimiter);
app.use('/api/messages', messagesSendLimiter);
app.use('/api', apiLimiter);

app.use(authMiddleware);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties/:propertyId/images', propertyImageRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/rentallog', rentalLogRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/', healthRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) {
    // Never forward raw DB/driver text (table names, SQL) to clients.
    return res.status(status).json({ message: 'Internal server error' });
  }
  res.status(status).json({ message: err.message || 'Internal server error' });
});

if (require.main === module) {
  const { checkConnection, ensureUserTokenVersionColumn, ensureUserProfileColumns, ensurePaymentsTable, ensurePropertyCoordinatePrecision, ensurePropertyImagesTable, ensurePropertyClientRequestId, ensureMessagingTables, sweepExpiredConversations } = require('./db');
  checkConnection()
    .then(() => console.log('MySQL connected'))
    .then(() => ensureUserTokenVersionColumn())
    .then(() => ensureUserProfileColumns())
    .then(() => ensurePaymentsTable())
    .then(() => ensurePropertyCoordinatePrecision())
    .then(() => ensurePropertyImagesTable())
    .then(() => ensurePropertyClientRequestId())
    .then(() => ensureMessagingTables())
    // Clear any chats that expired while the server was down.
    .then(() => sweepExpiredConversations())
    .catch((e) => console.warn('MySQL not reachable yet:', e.message))
    .finally(() => {
      app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
      // Chats self-destruct after 24 hours. A periodic sweep frees the rows even
      // when nobody is reading (reads also hide expired chats).
      const sweep = setInterval(() => {
        sweepExpiredConversations().catch((e) => console.warn('Message sweep failed:', e.message));
      }, 15 * 60 * 1000);
      sweep.unref();
    });
}

module.exports = app;
