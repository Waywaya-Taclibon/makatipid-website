require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const propertyRoutes = require('./routes/properties');
const rentalLogRoutes = require('./routes/rentallog');
const paymentRoutes = require('./routes/payments');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  })
);
app.use(express.json());

app.use(authMiddleware);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/rentallog', rentalLogRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/', healthRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

if (require.main === module) {
  const { checkConnection } = require('./db');
  checkConnection()
    .then(() => console.log('MySQL connected'))
    .catch((e) => console.warn('MySQL not reachable yet:', e.message))
    .finally(() => {
      app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
    });
}

module.exports = app;
