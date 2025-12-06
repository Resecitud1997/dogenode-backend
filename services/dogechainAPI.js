const axios = require('axios');
const config = require('../config/config');

class DogechainAPI {
    constructor() {
        this.baseUrl = config.dogechain.apiUrl;
        this.timeout = config.dogechain.timeout;
        
        this.axios = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // Verificar si está disponible
    isAvailable() {
        return config.dogechain.enabled;
    }

    // Obtener balance de una dirección
    async getAddressBalance(address) {
        try {
            const response = await this.axios.get(`/address/balance/${address}`);
            
            if (response.data && response.data.balance !== undefined) {
                return parseFloat(response.data.balance);
            }
            
            throw new Error('Formato de respuesta inválido');
        } catch (error) {
            console.error('Error obteniendo balance de Dogechain:', error.message);
            throw new Error('No se pudo obtener el balance de la dirección');
        }
    }

    // Obtener transacciones de una dirección
    async getAddressTransactions(address) {
        try {
            const response = await this.axios.get(`/address/transactions/${address}`);
            
            if (response.data && Array.isArray(response.data.transactions)) {
                return response.data.transactions.map(tx => ({
                    txid: tx.hash,
                    time: tx.time,
                    confirmations: tx.confirmations,
                    value: parseFloat(tx.value),
                    type: tx.type
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Error obteniendo transacciones:', error.message);
            return [];
        }
    }

    // Obtener información de transacción
    async getTransaction(txid) {
        try {
            const response = await this.axios.get(`/transaction/${txid}`);
            
            if (response.data && response.data.transaction) {
                const tx = response.data.transaction;
                return {
                    txid: tx.hash,
                    confirmations: tx.confirmations,
                    time: tx.time,
                    blockHash: tx.block_hash,
                    inputs: tx.inputs,
                    outputs: tx.outputs,
                    value: parseFloat(tx.value),
                    fee: parseFloat(tx.fee)
                };
            }
            
            throw new Error('Transacción no encontrada');
        } catch (error) {
            console.error('Error obteniendo transacción:', error.message);
            throw new Error('No se pudo obtener la información de la transacción');
        }
    }

    // Validar dirección
    async validateAddress(address) {
        try {
            // Validación básica de formato
            if (!address || typeof address !== 'string') {
                return false;
            }
            
            // Dogecoin addresses empiezan con 'D' y tienen 34 caracteres
            if (!address.startsWith('D') || address.length !== 34) {
                return false;
            }
            
            // Verificar si la dirección tiene transacciones (más confiable)
            try {
                await this.getAddressBalance(address);
                return true;
            } catch {
                // Si la dirección es válida pero no tiene balance, aún es válida
                return true;
            }
        } catch (error) {
            console.error('Error validando dirección:', error.message);
            return false;
        }
    }

    // Broadcast de transacción raw
    async broadcastTransaction(rawTx) {
        try {
            const response = await this.axios.post('/pushtx', {
                tx_hex: rawTx
            });
            
            if (response.data && response.data.txid) {
                return {
                    success: true,
                    txid: response.data.txid,
                    explorerUrl: `https://dogechain.info/tx/${response.data.txid}`
                };
            }
            
            throw new Error('No se pudo broadcast la transacción');
        } catch (error) {
            console.error('Error broadcasting transacción:', error.message);
            throw error;
        }
    }

    // Obtener precio actual de DOGE
    async getDogecoinPrice() {
        try {
            // Usar API de CoinGecko para precio
            const response = await axios.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd'
            );
            
            if (response.data && response.data.dogecoin) {
                return response.data.dogecoin.usd;
            }
            
            return 0.08; // Precio por defecto
        } catch (error) {
            console.error('Error obteniendo precio:', error.message);
            return 0.08;
        }
    }

    // Obtener estadísticas de la red
    async getNetworkStats() {
        try {
            const response = await this.axios.get('/stats');
            
            if (response.data) {
                return {
                    difficulty: response.data.difficulty,
                    hashRate: response.data.hash_rate,
                    blockHeight: response.data.block_height,
                    blockTime: response.data.block_time
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error.message);
            return null;
        }
    }

    // Obtener UTXO de una dirección (para crear transacciones)
    async getUnspentOutputs(address) {
        try {
            const response = await this.axios.get(`/address/unspent/${address}`);
            
            if (response.data && Array.isArray(response.data.unspent_outputs)) {
                return response.data.unspent_outputs.map(utxo => ({
                    txid: utxo.tx_hash,
                    vout: utxo.tx_output_n,
                    value: parseFloat(utxo.value),
                    confirmations: utxo.confirmations
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Error obteniendo UTXO:', error.message);
            return [];
        }
    }

    // Estimar fee de red
    async estimateFee() {
        try {
            // Dogechain no tiene endpoint específico para esto
            // Retornar fee recomendado basado en la red
            return 1.0; // 1 DOGE por transacción (estándar)
        } catch (error) {
            console.error('Error estimando fee:', error.message);
            return 1.0;
        }
    }
}

module.exports = new DogechainAPI();
