const Client = require('bitcoin-core');
const config = require('../config/config');

class DogecoinNode {
    constructor() {
        if (!config.dogecoin.enabled) {
            console.log('⚠️ Nodo de Dogecoin deshabilitado');
            return;
        }

        this.client = new Client({
            host: config.dogecoin.host,
            port: config.dogecoin.port,
            username: config.dogecoin.username,
            password: config.dogecoin.password,
            network: config.dogecoin.network
        });

        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            const info = await this.client.getBlockchainInfo();
            console.log('✅ Conectado al nodo de Dogecoin');
            console.log(`📊 Bloques: ${info.blocks}`);
            console.log(`🌐 Red: ${info.chain}`);
            this.initialized = true;
        } catch (error) {
            console.error('❌ Error conectando al nodo de Dogecoin:', error.message);
            this.initialized = false;
        }
    }

    // Verificar si está disponible
    isAvailable() {
        return config.dogecoin.enabled && this.initialized;
    }

    // Obtener nueva dirección
    async getNewAddress(label = 'dogenode') {
        try {
            const address = await this.client.getNewAddress(label);
            console.log(`🏠 Nueva dirección generada: ${address}`);
            return address;
        } catch (error) {
            console.error('Error generando dirección:', error);
            throw new Error('No se pudo generar una nueva dirección');
        }
    }

    // Obtener balance
    async getBalance(address = null) {
        try {
            if (address) {
                // Balance de una dirección específica
                const received = await this.client.getReceivedByAddress(
                    address,
                    config.dogecoin.minConfirmations
                );
                return received;
            } else {
                // Balance total de la wallet
                const balance = await this.client.getBalance();
                return balance;
            }
        } catch (error) {
            console.error('Error obteniendo balance:', error);
            throw new Error('No se pudo obtener el balance');
        }
    }

    // Validar dirección
    async validateAddress(address) {
        try {
            const validation = await this.client.validateAddress(address);
            return validation.isvalid;
        } catch (error) {
            console.error('Error validando dirección:', error);
            return false;
        }
    }

    // Enviar Dogecoin
    async sendToAddress(toAddress, amount, comment = '') {
        try {
            // Validar dirección
            const isValid = await this.validateAddress(toAddress);
            if (!isValid) {
                throw new Error('Dirección de destino inválida');
            }

            // Verificar balance
            const balance = await this.getBalance();
            if (balance < amount) {
                throw new Error('Saldo insuficiente en el nodo');
            }

            // Enviar transacción
            const txid = await this.client.sendToAddress(
                toAddress,
                amount,
                comment,
                '', // comment_to
                false, // subtractfeefromamount
                true // replaceable (RBF)
            );

            console.log(`✅ Transacción enviada: ${txid}`);
            
            return {
                success: true,
                txid: txid,
                amount: amount,
                to: toAddress,
                explorerUrl: `https://dogechain.info/tx/${txid}`
            };

        } catch (error) {
            console.error('Error enviando Dogecoin:', error);
            throw error;
        }
    }

    // Obtener información de transacción
    async getTransaction(txid) {
        try {
            const tx = await this.client.getTransaction(txid);
            return {
                txid: tx.txid,
                amount: tx.amount,
                confirmations: tx.confirmations,
                blockhash: tx.blockhash,
                blocktime: tx.blocktime,
                time: tx.time,
                details: tx.details
            };
        } catch (error) {
            console.error('Error obteniendo transacción:', error);
            throw new Error('Transacción no encontrada');
        }
    }

    // Estimar fee
    async estimateFee(blocks = 2) {
        try {
            const feeRate = await this.client.estimateSmartFee(blocks);
            return feeRate.feerate || 0.01; // Default 0.01 DOGE si no hay estimación
        } catch (error) {
            console.error('Error estimando fee:', error);
            return 0.01;
        }
    }

    // Listar transacciones recientes
    async listTransactions(count = 10, skip = 0) {
        try {
            const transactions = await this.client.listTransactions('*', count, skip);
            return transactions.map(tx => ({
                txid: tx.txid,
                category: tx.category,
                amount: tx.amount,
                confirmations: tx.confirmations,
                time: tx.time,
                address: tx.address
            }));
        } catch (error) {
            console.error('Error listando transacciones:', error);
            throw new Error('No se pudieron obtener las transacciones');
        }
    }

    // Crear transacción raw (avanzado)
    async createRawTransaction(inputs, outputs) {
        try {
            const rawTx = await this.client.createRawTransaction(inputs, outputs);
            return rawTx;
        } catch (error) {
            console.error('Error creando transacción raw:', error);
            throw error;
        }
    }

    // Firmar transacción raw
    async signRawTransaction(rawTx) {
        try {
            const signed = await this.client.signRawTransactionWithWallet(rawTx);
            return signed;
        } catch (error) {
            console.error('Error firmando transacción:', error);
            throw error;
        }
    }

    // Broadcast transacción
    async sendRawTransaction(signedTx) {
        try {
            const txid = await this.client.sendRawTransaction(signedTx);
            return txid;
        } catch (error) {
            console.error('Error broadcasting transacción:', error);
            throw error;
        }
    }

    // Backup de wallet
    async backupWallet(destination) {
        try {
            await this.client.backupWallet(destination);
            console.log(`💾 Backup creado en: ${destination}`);
            return true;
        } catch (error) {
            console.error('Error creando backup:', error);
            return false;
        }
    }

    // Obtener información del nodo
    async getNodeInfo() {
        try {
            const [blockchain, network, wallet] = await Promise.all([
                this.client.getBlockchainInfo(),
                this.client.getNetworkInfo(),
                this.client.getWalletInfo()
            ]);

            return {
                blockchain: {
                    chain: blockchain.chain,
                    blocks: blockchain.blocks,
                    headers: blockchain.headers,
                    difficulty: blockchain.difficulty
                },
                network: {
                    version: network.version,
                    subversion: network.subversion,
                    connections: network.connections
                },
                wallet: {
                    balance: wallet.balance,
                    txcount: wallet.txcount
                }
            };
        } catch (error) {
            console.error('Error obteniendo info del nodo:', error);
            throw error;
        }
    }
}

module.exports = new DogecoinNode();
