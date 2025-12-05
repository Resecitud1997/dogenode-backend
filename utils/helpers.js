const crypto = require('crypto');

// Generar hash de transacción realista
function generateTxHash() {
  return crypto.randomBytes(32).toString('hex');
}

// Validar dirección de Dogecoin
function isValidDogeAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // Dogecoin addresses empiezan con 'D' y tienen 34 caracteres
  const dogeRegex = /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/;
  return dogeRegex.test(address);
}

// Validar cantidad
function isValidAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num < 1000000;
}

// Formatear respuesta de éxito
function successResponse(data, message = 'Operación exitosa') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

// Formatear respuesta de error
function errorResponse(error, statusCode = 400) {
  return {
    success: false,
    error: error,
    statusCode,
    timestamp: new Date().toISOString()
  };
}

// Calcular fee de transacción
function calculateFee(amount) {
  // Fee fijo de 1 DOGE
  return 1.0;
}

// Generar ID único
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Formatear número con decimales
function formatDoge(amount) {
  return parseFloat(amount).toFixed(8);
}

// Delay simulado (para simular procesamiento)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateTxHash,
  isValidDogeAddress,
  isValidAmount,
  successResponse,
  errorResponse,
  calculateFee,
  generateId,
  formatDoge,
  delay
};
