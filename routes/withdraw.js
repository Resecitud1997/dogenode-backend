const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const dogecoinNode = require('../services/dogecoinNode');
const dogechainAPI = require('../services/dogechainAPI');
const wrappedDoge = require('../services/wrappedDoge');
const config = require('../config/config');

// POST /api/withdraw/request
router.post('/request', async (req, res) => {
    try {
        const { userId, toAddress, amount, method = 'auto' } = req.body;
        
        // Validaciones básicas
        if (!userId || !toAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros requeridos'
            });
        }
        
        // Validar monto
        if (amount < config.withdrawal.minAmount) {
            return res.status(400).json({
                success: false,
                error: `Monto mínimo de retiro: ${config.withdrawal.minAmount} DOGE`
            });
        }
        
        if (amount > config.withdrawal.maxAmount) {
            return res.status(400).json({
                success: false,
                error: `Monto máximo de retiro: ${config.withdrawal.maxAmount} DOGE`
            });
        }
        
        // Obtener usuario
        const user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        // Verificar si puede retirar
        const canWithdraw = user.canWithdraw(amount);
        if (!canWithdraw.allowed) {
            return res.status(400).json({
                success: false,
                error: canWithdraw.reason
            });
        }
        
        // Calcular fee
        const fee = config.withdrawal.feeFixed + (amount * config.withdrawal.feePercent);
        const totalAmount = amount + fee;
        
        // Verificar balance total
        if (user.balance.available < totalAmount) {
            return res.status(400).json({
                success: false,
                error: `Saldo insuficiente. Necesitas ${totalAmount.toFixed(2)} DOGE (incluyendo ${fee.toFixed(2)} DOGE de fee)`
            });
        }
        
        // Validar dirección según método
        let isValidAddress = false;
        let selectedMethod = method;
        
        if (method === 'auto') {
            // Detectar automáticamente el método basado en la dirección
            if (toAddress.startsWith('D')) {
                selectedMethod = dogecoinNode.isAvailable() ? 'dogecoin_node' : 'dogechain_api';
                isValidAddress = true;
            } else if (toAddress.startsWith('0x')) {
                selectedMethod = 'wrapped_doge';
                isValidAddress = wrappedDoge.isValidAddress(toAddress);
            }
        } else {
            // Validar según método específico
            if (selectedMethod === 'dogecoin_node') {
                isValidAddress = await dogecoinNode.validateAddress(toAddress);
            } else if (selectedMethod === 'dogechain_api') {
                isValidAddress = await dogechainAPI.validateAddress(toAddress);
            } else if (selectedMethod === 'wrapped_doge') {
                isValidAddress = wrappedDoge.isValidAddress(toAddress);
            }
        }
        
        if (!isValidAddress) {
            return res.status(400).json({
                success: false,
                error: 'Dirección de destino inválida'
            });
        }
        
        // Crear transacción
        const transaction = new Transaction({
            txId: `withdrawal_${Date.now()}_${userId}`,
            userId,
            type: 'withdrawal',
            method: selectedMethod,
            amount,
            fee,
            netAmount: amount,
            toAddress,
            status: 'pending',
            metadata: {
                description: 'Retiro de usuario',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            }
        });
        
        await transaction.save();
        
        // Actualizar balance (poner en pending)
        user.balance.available -= totalAmount;
        user.balance.pending += totalAmount;
        await user.save();
        
        // Procesar retiro en background
        processWithdrawal(transaction._id).catch(error => {
            console.error('Error procesando retiro:', error);
        });
        
        res.json({
            success: true,
            message: 'Solicitud de retiro creada exitosamente',
            data: {
                transactionId: transaction.txId,
                amount,
                fee,
                totalAmount,
                toAddress,
                status: 'pending',
                estimatedTime: '5-15 minutos'
            }
        });
        
    } catch (error) {
        console.error('Error en solicitud de retiro:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar solicitud de retiro'
        });
    }
});

// Función para procesar retiro en background
async function processWithdrawal(transactionId) {
    try {
        const transaction = await Transaction.findById(transactionId);
        
        if (!transaction || transaction.status !== 'pending') {
            return;
        }
        
        // Marcar como procesando
        await transaction.markAsProcessing();
        
        let result;
        
        // Procesar según método
        switch (transaction.method) {
            case 'dogecoin_node':
                if (!dogecoinNode.isAvailable()) {
                    throw new Error('Nodo de Dogecoin no disponible');
                }
                result = await dogecoinNode.sendToAddress(
                    transaction.toAddress,
                    transaction.netAmount,
                    `DogeNode withdrawal ${transaction.txId}`
                );
                break;
                
            case 'dogechain_api':
                // Para Dogechain API necesitas implementar la lógica de firma y broadcast
                throw new Error('Método Dogechain API requiere implementación adicional');
                
            case 'wrapped_doge':
                if (!wrappedDoge.isAvailable()) {
                    throw new Error('Servicio de Wrapped DOGE no disponible');
                }
                result = await wrappedDoge.transfer(
                    transaction.toAddress,
                    transaction.netAmount
                );
                break;
                
            default:
                throw new Error('Método de retiro no soportado');
        }
        
        // Actualizar transacción como completada
        await transaction.markAsCompleted(result.txid || result.txHash, result.explorerUrl);
        
        // Actualizar usuario
        const user = await User.findOne({ userId: transaction.userId });
        user.balance.pending -= (transaction.amount + transaction.fee);
        await user.recordWithdrawal(transaction.amount);
        
        console.log(`✅ Retiro completado: ${transaction.txId}`);
        
    } catch (error) {
        console.error('Error procesando retiro:', error);
        
        const transaction = await Transaction.findById(transactionId);
        
        // Marcar como fallido
        await transaction.markAsFailed(error.message, 'WITHDRAWAL_ERROR');
        
        // Devolver fondos al usuario
        const user = await User.findOne({ userId: transaction.userId });
        user.balance.pending -= (transaction.amount + transaction.fee);
        user.balance.available += (transaction.amount + transaction.fee);
        await user.save();
    }
}

// GET /api/withdraw/status/:transactionId
router.get('/status/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        const transaction = await Transaction.findOne({ txId: transactionId });
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transacción no encontrada'
            });
        }
        
        // Si está completada, obtener confirmaciones actualizadas
        if (transaction.status === 'completed' && transaction.blockchain.txHash) {
            try {
                let confirmations = 0;
                
                if (transaction.method === 'dogecoin_node' && dogecoinNode.isAvailable()) {
                    const txInfo = await dogecoinNode.getTransaction(transaction.blockchain.txHash);
                    confirmations = txInfo.confirmations;
                } else if (transaction.method === 'wrapped_doge' && wrappedDoge.isAvailable()) {
                    const txInfo = await wrappedDoge.getTransaction(transaction.blockchain.txHash);
                    confirmations = txInfo.confirmations;
