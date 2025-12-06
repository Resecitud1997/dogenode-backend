const { Web3 } = require('web3');
const config = require('../config/config');

// ABI del contrato de Wrapped DOGE (ERC-20 estándar)
const WDOGE_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "from", "type": "address"},
            {"indexed": true, "name": "to", "type": "address"},
            {"indexed": false, "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    }
];

class WrappedDogeService {
    constructor() {
        if (!config.wrappedDoge.enabled) {
            console.log('⚠️ Wrapped DOGE deshabilitado');
            return;
        }

        try {
            this.web3 = new Web3(config.wrappedDoge.rpcUrl);
            this.contract = new this.web3.eth.Contract(
                WDOGE_ABI,
                config.wrappedDoge.contractAddress
            );
            
            if (config.wrappedDoge.privateKey) {
                this.account = this.web3.eth.accounts.privateKeyToAccount(
                    config.wrappedDoge.privateKey
                );
                this.web3.eth.accounts.wallet.add(this.account);
                console.log(`✅ Wallet BSC configurada: ${this.account.address}`);
            }

            this.initialized = true;
            console.log('✅ Servicio de Wrapped DOGE inicializado');
        } catch (error) {
            console.error('❌ Error inicializando Wrapped DOGE:', error.message);
            this.initialized = false;
        }
    }

    // Verificar si está disponible
    isAvailable() {
        return config.wrappedDoge.enabled && this.initialized;
    }

    // Obtener balance de wDOGE
    async getBalance(address) {
        try {
            const balance = await this.contract.methods.balanceOf(address).call();
            const decimals = await this.contract.methods.decimals().call();
            
            // Convertir de Wei a DOGE
            const balanceInDoge = this.web3.utils.fromWei(balance, 'ether');
            return parseFloat(balanceInDoge);
        } catch (error) {
            console.error('Error obteniendo balance de wDOGE:', error);
            throw new Error('No se pudo obtener el balance');
        }
    }

    // Transferir wDOGE
    async transfer(toAddress, amount) {
        try {
            if (!this.account) {
                throw new Error('No hay cuenta configurada para firmar transacciones');
            }

            // Validar dirección
            if (!this.web3.utils.isAddress(toAddress)) {
                throw new Error('Dirección de destino inválida');
            }

            // Convertir cantidad a Wei
            const amountInWei = this.web3.utils.toWei(amount.toString(), 'ether');

            // Verificar balance
            const balance = await this.getBalance(this.account.address);
            if (balance < amount) {
                throw new Error('Saldo insuficiente de wDOGE');
            }

            // Estimar gas
            const gasEstimate = await this.contract.methods
                .transfer(toAddress, amountInWei)
                .estimateGas({ from: this.account.address });

            // Obtener precio de gas
            const gasPrice = await this.web3.eth.getGasPrice();

            // Crear transacción
            const tx = {
                from: this.account.address,
                to: config.wrappedDoge.contractAddress,
                gas: Math.floor(gasEstimate * 1.2), // 20% extra de seguridad
                gasPrice: gasPrice,
                data: this.contract.methods.transfer(toAddress, amountInWei).encodeABI()
            };

            // Firmar y enviar transacción
            const signedTx = await this.web3.eth.accounts.signTransaction(
                tx,
                config.wrappedDoge.privateKey
            );

            const receipt = await this.web3.eth.sendSignedTransaction(
                signedTx.rawTransaction
            );

            console.log(`✅ Transacción de wDOGE enviada: ${receipt.transactionHash}`);

            return {
                success: true,
                txHash: receipt.transactionHash,
                amount: amount,
                to: toAddress,
                explorerUrl: `https://bscscan.com/tx/${receipt.transactionHash}`
            };

        } catch (error) {
            console.error('Error transfiriendo wDOGE:', error);
            throw error;
        }
    }

    // Obtener información de transacción
    async getTransaction(txHash) {
        try {
            const tx = await this.web3.eth.getTransaction(txHash);
            const receipt = await this.web3.eth.getTransactionReceipt(txHash);

            return {
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: this.web3.utils.fromWei(tx.value, 'ether'),
                gasUsed: receipt.gasUsed,
                status: receipt.status,
                blockNumber: receipt.blockNumber,
                confirmations: await this.getConfirmations(receipt.blockNumber)
            };
        } catch (error) {
            console.error('Error obteniendo transacción:', error);
            throw new Error('Transacción no encontrada');
        }
    }

    // Obtener confirmaciones
    async getConfirmations(blockNumber) {
        try {
            const currentBlock = await this.web3.eth.getBlockNumber();
            return currentBlock - blockNumber;
        } catch (error) {
            console.error('Error obteniendo confirmaciones:', error);
            return 0;
        }
    }

    // Validar dirección BSC
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }

    // Obtener precio de gas actual
    async getGasPrice() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            return this.web3.utils.fromWei(gasPrice, 'gwei');
        } catch (error) {
            console.error('Error obteniendo precio de gas:', error);
            return '5'; // Default 5 Gwei
        }
    }

    // Estimar costo de transacción
    async estimateTransactionCost(toAddress, amount) {
        try {
            const amountInWei = this.web3.utils.toWei(amount.toString(), 'ether');
            
            const gasEstimate = await this.contract.methods
                .transfer(toAddress, amountInWei)
                .estimateGas({ from: this.account.address });

            const gasPrice = await this.web3.eth.getGasPrice();
            
            const costInWei = BigInt(gasEstimate) * BigInt(gasPrice);
            const costInBNB = this.web3.utils.fromWei(costInWei.toString(), 'ether');

            return {
                gasLimit: gasEstimate,
                gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei'),
                totalCostBNB: parseFloat(costInBNB)
            };
        } catch (error) {
            console.error('Error estimando costo:', error);
            throw error;
        }
    }
}

module.exports = new WrappedDogeService();
