require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Importar rutas
const balanceRoutes = require('./routes/balance');
const earningsRoutes = require('./routes/earnings');
const withdrawRoutes = require('./routes/withdraw');
const transactionsRoutes = require('./routes/transactions');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================
// MIDDLEWARES DE SEGURIDAD
// ========================

// Helmet para headers de seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    success: false,
    error: 'Demasiadas peticiones, intenta más tarde'
  }
});

app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan('combined'));

// ========================
// RUTAS
// ========================

// Página principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'DogeNode Backend API',
    version: '2.0.0',
    status: 'Tu servidor está funcionando correctamente',
    endpoints: {
      health: '/api/health',
      balance: 'GET /api/balance/:address',
      earnings: 'POST /api/earnings',
      withdraw: 'POST /api/withdraw',
      transactions: 'GET /api/transactions/:address'
    },
    documentation: 'https://dogenode.com/docs'
  });
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/transactions', transactionsRoutes);

// ========================
// ERROR HANDLERS
// ========================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    path: req.path
  });
});

// Error Handler Global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ========================
// INICIAR SERVIDOR
// ========================

app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 DogeNode Backend API');
  console.log('=================================');
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Endpoints disponibles en: http://localhost:${PORT}/api`);
  console.log('=================================');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
