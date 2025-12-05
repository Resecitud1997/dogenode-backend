const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { successResponse, errorResponse, isValidDogeAddress } = require('../utils/helpers');

// GET /api/balance/:address
router.get('/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    // Validar dirección
    if (!isValidDogeAddress(address)) {
      return res.status(400).json(
        errorResponse('Dirección de Dogecoin inválida')
      );
    }
    
    // Obtener usuario
    const user = db.getUser(address);
    
    res.json(successResponse({
      address: user.address,
      balance: user.balance,
      totalEarnings: user.totalEarnings,
      withdrawals: user.withdrawals,
      lastActivity: user.lastActivity
    }, 'Balance obtenido correctamente'));
    
  } catch (error) {
    console.error('Error en balance:', error);
    res.status(500).json(errorResponse('Error al obtener balance', 500));
  }
});

module.exports = router;
