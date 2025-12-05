const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { 
  successResponse, 
  errorResponse, 
  isValidDogeAddress, 
  isValidAmount,
  formatDoge 
} = require('../utils/helpers');

// POST /api/earnings
router.post('/', async (req, res) => {
  try {
    const { address, amount } = req.body;
    
    // Validaciones
    if (!address || !amount) {
      return res.status(400).json(
        errorResponse('Faltan parámetros: address y amount son requeridos')
      );
    }
    
    if (!isValidDogeAddress(address)) {
      return res.status(400).json(
        errorResponse('Dirección de Dogecoin inválida')
      );
    }
    
    if (!isValidAmount(amount)) {
      return res.status(400).json(
        errorResponse('Cantidad inválida')
      );
    }
    
    // Actualizar ganancias
    const user = db.addEarnings(address, parseFloat(amount));
    
    res.json(successResponse({
      address: user.address,
      amountAdded: formatDoge(amount),
      newBalance: formatDoge(user.balance),
      totalEarnings: formatDoge(user.totalEarnings)
    }, 'Ganancias actualizadas correctamente'));
    
  } catch (error) {
    console.error('Error en earnings:', error);
    res.status(500).json(errorResponse('Error al actualizar ganancias', 500));
  }
});

// GET /api/earnings/history/:address
router.get('/history/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    if (!isValidDogeAddress(address)) {
      return res.status(400).json(
        errorResponse('Dirección de Dogecoin inválida')
      );
    }
    
    const history = db.getEarningsHistory(address);
    
    res.json(successResponse({
      address,
      history,
      total: history.reduce((sum, e) => sum + e.amount, 0)
    }, 'Historial obtenido correctamente'));
    
  } catch (error) {
    console.error('Error en earnings history:', error);
    res.status(500).json(errorResponse('Error al obtener historial', 500));
  }
});

module.exports = router;
