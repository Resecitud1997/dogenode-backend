const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { 
  successResponse, 
  errorResponse, 
  isValidDogeAddress, 
  isValidAmount,
  generateTxHash,
  calculateFee,
  formatDoge,
  delay
} = require('../utils/helpers');

// POST /api/withdraw
router.post('/', async (req, res) => {
  try {
    const { fromAddress, toAddress, amount } = req.body;
    
    // ==================
    // VALIDACIONES
    // ==================
    
    if (!fromAddress || !toAddress || !amount) {
      return res.status(400).json(
        errorResponse('Faltan parámetros: fromAddress, toAddress y amount son requeridos')
      );
    }
    
    if (!isValidDogeAddress(fromAddress)) {
      return res.status(400).json(
        errorResponse('Dirección de origen inválida')
      );
    }
    
    if (!isValidDogeAddress(toAddress)) {
      return res.status(400).json(
        errorResponse('Dirección de destino inválida')
      );
    }
    
    if (!isValidAmount(amount)) {
      return res.status(400).json(
        errorResponse('Cantidad inválida')
      );
    }
    
    const withdrawAmount = parseFloat(amount);
    
    // Validar mínimo de retiro
    if (withdrawAmount < 10) {
      return res.status(400).json(
        errorResponse('El monto mínimo de retiro es 10 DOGE')
      );
    }
    
    // Obtener usuario
    const user = db.getUser(fromAddress);
    
    // Calcular fee
    const fee = calculateFee(withdrawAmount);
    const totalAmount = withdrawAmount + fee;
    
    // Validar balance suficiente
    if (user.balance < totalAmount) {
      return res.status(400).json(
        errorResponse(`Saldo insuficiente. Necesitas ${formatDoge(totalAmount)} DOGE (incluyendo ${formatDoge(fee)} DOGE de fee)`)
      );
    }
    
    // ==================
    // PROCESAR RETIRO
    // ==================
    
    // Simular procesamiento (en producción aquí va la conexión con blockchain)
    await delay(1500);
    
    // Generar hash de transacción
    const txHash = generateTxHash();
    
    // Actualizar balance del usuario
    user.balance -= totalAmount;
    user.withdrawals += 1;
    db.updateUser(fromAddress, user);
    
    // Guardar transacción
    const transaction = db.addTransaction({
      txHash,
      fromAddress,
      toAddress,
      amount: withdrawAmount,
      fee: fee,
      totalAmount: totalAmount,
      type: 'withdrawal',
      status: 'completed',
      explorerUrl: `https://dogechain.info/tx/${txHash}`
    });
    
    // ==================
    // RESPUESTA
    // ==================
    
    res.json(successResponse({
      txHash: transaction.txHash,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      amount: formatDoge(transaction.amount),
      fee: formatDoge(transaction.fee),
      totalAmount: formatDoge(transaction.totalAmount),
      newBalance: formatDoge(user.balance),
      status: transaction.status,
      explorerUrl: transaction.explorerUrl,
      timestamp: transaction.createdAt
    }, 'Retiro procesado exitosamente'));
    
  } catch (error) {
    console.error('Error en withdraw:', error);
    res.status(500).json(errorResponse('Error al procesar retiro', 500));
  }
});

module.exports = router;