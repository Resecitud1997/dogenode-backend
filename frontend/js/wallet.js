// Sistema de Wallet con Backend Real
const Wallet = {
    
    connected: false,
    address: null,
    type: null,
    userId: null,

    // ==================
    // INICIALIZACIÓN
    // ==================

    async initialize() {
        // Obtener o crear userId
        this.userId = Storage.get('userId');
        if (!this.userId) {
            this.userId = this.generateUserId();
            Storage.set('userId', this.userId);
        }

        // Restaurar wallet si existe
        const savedWallet = Storage.getWallet();
        if (savedWallet) {
            this.connected = true;
            this.address = savedWallet.address;
            this.type = savedWallet.type;
            
            // Sincronizar con backend
            await this.syncWithBackend();
        }

        // Verificar extensión
        this.checkExtension();
    },

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // ==================
    // DETECCIÓN DE EXTENSIÓN
    // ==================

    checkExtension() {
        if (window.DogeNode && window.DogeNode.isExtensionInstalled()) {
            console.log('✅ Extensión DogeNode detectada');
            this.setupExtensionListeners();
            this.updateExtensionStatus(true);
            return true;
        } else {
            console.log('⚠️ Extensión DogeNode no detectada');
            this.updateExtensionStatus(false);
            return false;
        }
    },

    updateExtensionStatus(installed) {
        const alert = document.getElementById('extensionAlert');
        const footer = document.getElementById('extensionStatusFooter');

        if (installed) {
            if (alert) alert.style.display = 'none';
            if (footer) {
                footer.innerHTML = '<i class="fas fa-circle text-green-500 mr-2"></i>Extensión: Instalada';
            }
        } else {
            if (alert) alert.style.display = 'block';
            if (footer) {
                footer.innerHTML = '<i class="fas fa-circle text-red-500 mr-2"></i>Extensión: No detectada';
            }
        }
    },

    // ==================
    // CONEXIÓN DE WALLET
    // ==================

    async connect(walletType = 'dogecore') {
        try {
            Utils.showInfo('Conectando wallet...');

            // Generar o solicitar dirección
            let address;
            
            if (walletType === 'dogecore' || walletType === 'dogecoin') {
                address = prompt('Ingresa tu dirección de Dogecoin:');
                if (!address) {
                    throw new Error('Dirección no proporcionada');
                }
                
                // Validar formato
                if (!this.validateDogeAddress(address)) {
                    throw new Error('Dirección de Dogecoin inválida');
                }
            } else if (walletType === 'metamask') {
                // Conectar con MetaMask
                if (typeof window.ethereum !== 'undefined') {
                    const accounts = await window.ethereum.request({ 
                        method: 'eth_requestAccounts' 
                    });
                    address = accounts[0];
                } else {
                    throw new Error('MetaMask no está instalado');
                }
            }

            // Conectar con backend
            const response = await api.connectWallet(this.userId, address, walletType);

            if (response.success) {
                this.connected = true;
                this.address = address;
                this.type = walletType;

                // Guardar localmente
                Storage.saveWallet({
                    address: address,
                    type: walletType,
                    connectedAt: new Date().toISOString()
                });

                // Actualizar UI
                this.updateWalletUI();

                // Sincronizar balance
                await this.syncWithBackend();

                Utils.showSuccess('¡Wallet conectada exitosamente!');

                // Notificar a la extensión si está disponible
                if (window.DogeNode) {
                    window.DogeNode.emit('onWalletConnected', {
                        address: address,
                        type: walletType
                    });
                }

                return true;
            } else {
                throw new Error(response.error || 'Error conectando wallet');
            }

        } catch (error) {
            console.error('Error conectando wallet:', error);
            Utils.showError(error.message || 'Error al conectar la wallet');
            return false;
        }
    },

    validateDogeAddress(address) {
        if (!address || typeof address !== 'string') return false;
        const dogeRegex = /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/;
        return dogeRegex.test(address);
    },

    // ==================
    // SINCRONIZACIÓN CON BACKEND
    // ==================

    async syncWithBackend() {
        try {
            // Obtener balance del backend
            const balanceResponse = await api.getBalance(this.userId);
            
            if (balanceResponse.success) {
                // Actualizar localStorage con datos del backend
                const userData = Storage.getUser();
                userData.balance = balanceResponse.data.available;
                userData.totalEarnings = balanceResponse.data.totalEarned;
                userData.totalWithdrawals = balanceResponse.data.totalWithdrawn;
                Storage.saveUser(userData);

                // Actualizar UI
                if (typeof App !== 'undefined') {
                    App.updateStats();
                }
            }

            // Obtener estadísticas completas
            const statsResponse = await api.getUserStats(this.userId);
            
            if (statsResponse.success) {
                const userData = Storage.getUser();
                userData.stats = statsResponse.data.stats;
                userData.referralCount = statsResponse.data.referral.referredCount;
                Storage.saveUser(userData);
            }

        } catch (error) {
            console.error('Error sincronizando con backend:', error);
        }
    },

    // ==================
    // DESCONEXIÓN
    // ==================

    disconnect() {
        this.connected = false;
        this.address = null;
        this.type = null;

        Storage.removeWallet();
        this.updateWalletUI();

        if (window.DogeNode) {
            window.DogeNode.emit('onWalletDisconnected', {});
        }

        Utils.showInfo('Wallet desconectada');
    },

    // ==================
    // RETIROS CON BACKEND REAL
    // ==================

    async withdraw(toAddress, amount) {
        if (!this.connected) {
            Utils.showError('Debes conectar tu wallet primero');
            return false;
        }

        try {
            Utils.showInfo('Procesando retiro...');

            // Validar dirección
            if (!this.validateDogeAddress(toAddress)) {
                throw new Error('Dirección de destino inválida');
            }

            // Validar monto
            if (amount < 10) {
                throw new Error('El monto mínimo de retiro es 10 DOGE');
            }

            // Solicitar retiro al backend
            const response = await api.requestWithdrawal(
                this.userId,
                toAddress,
                amount,
                'auto' // Detección automática de método
            );

            if (response.success) {
                const txData = response.data;

                // Actualizar balance local
                const userData = Storage.getUser();
                userData.balance -= txData.totalAmount;
                userData.totalWithdrawals += 1;
                Storage.saveUser(userData);

                // Guardar transacción local
                Storage.addTransaction({
                    type: 'withdrawal',
                    amount: txData.amount,
                    fee: txData.fee,
                    toAddress: txData.toAddress,
                    txHash: null, // Se actualizará cuando se complete
                    status: 'pending',
                    transactionId: txData.transactionId
                });

                // Actualizar UI
                if (typeof App !== 'undefined') {
                    App.updateStats();
                    App.loadTransactions();
                }

                Utils.showSuccess(`¡Retiro solicitado! Tiempo estimado: ${txData.estimatedTime}`);

                // Monitorear estado de la transacción
                this.monitorWithdrawal(txData.transactionId);

                return true;
            } else {
                throw new Error(response.error || 'Error en el retiro');
            }

        } catch (error) {
            console.error('Error en retiro:', error);
            Utils.showError(error.message || 'Error al procesar el retiro');
            return false;
        }
    },

    // Monitorear estado del retiro
    async monitorWithdrawal(transactionId) {
        let attempts = 0;
        const maxAttempts = 20; // 20 intentos = ~5 minutos
        
        const checkStatus = async () => {
            try {
                const response = await api.getWithdrawalStatus(transactionId);
                
                if (response.success) {
                    const tx = response.data;
                    
                    if (tx.status === 'completed') {
                        // Actualizar transacción local
                        const transactions = Storage.getTransactions();
                        const localTx = transactions.find(t => t.transactionId === transactionId);
                        if (localTx) {
                            localTx.status = 'completed';
                            localTx.txHash = tx.txHash;
                            localTx.explorerUrl = tx.explorerUrl;
                            localTx.confirmations = tx.confirmations;
                            Storage.set(Storage.KEYS.TRANSACTIONS, transactions);
                        }

                        Utils.showSuccess(`¡Retiro completado! TxHash: ${tx.txHash.substring(0, 16)}...`);
                        
                        if (typeof App !== 'undefined') {
                            App.loadTransactions();
                        }
                        
                        return; // Detener monitoreo
                    } else if (tx.status === 'failed') {
                        Utils.showError(`Retiro fallido: ${tx.error?.message || 'Error desconocido'}`);
                        return; // Detener monitoreo
                    }
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, 15000); // Verificar cada 15 segundos
                } else {
                    Utils.showWarning('El retiro está tomando más tiempo de lo esperado. Verifica el estado más tarde.');
                }

            } catch (error) {
                console.error('Error monitoreando retiro:', error);
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, 15000);
                }
            }
        };

        // Iniciar monitoreo después de 5 segundos
        setTimeout(checkStatus, 5000);
    },

    // ==================
    // AGREGAR GANANCIAS CON BACKEND
    // ==================

    async addEarnings(amount, source = 'mining') {
        try {
            const response = await api.addEarnings(this.userId, amount, source);

            if (response.success) {
                // Actualizar localStorage
                const userData = Storage.getUser();
                userData.balance = response.data.newBalance;
                userData.totalEarnings = response.data.totalEarnings;
                Storage.saveUser(userData);

                // Actualizar UI
                if (typeof App !== 'undefined') {
                    App.updateStats();
                }

                return true;
            }

            return false;

        } catch (error) {
            console.error('Error agregando ganancias:', error);
            return false;
        }
    },

    // ==================
    // UI
    // ==================

    updateWalletUI() {
        const walletStatus = document.getElementById('walletStatus');
        const walletConnected = document.getElementById('walletConnected');
        const navWalletText = document.getElementById('navWalletText');
        const walletAddressNav = document.getElementById('walletAddressNav');
        const connectedAddress = document.getElementById('connectedAddress');

        if (this.connected && this.address) {
            Utils.show('walletStatus');
            Utils.show('walletConnected');
            
            if (navWalletText) navWalletText.textContent = 'Gestionar';
            if (walletAddressNav) walletAddressNav.textContent = Utils.formatAddress(this.address);
            if (connectedAddress) connectedAddress.textContent = this.address;

        } else {
            Utils.hide('walletStatus');
            Utils.hide('walletConnected');
            
            if (navWalletText) navWalletText.textContent = 'Conectar Wallet';
        }
    },

    setupExtensionListeners() {
        if (window.DogeNode) {
            window.DogeNode.on('onWalletConnected', async (wallet) => {
                console.log('Wallet conectada desde extensión:', wallet);
                // Sincronizar con backend
                await this.connect(wallet.walletType || 'dogecore');
            });

            window.DogeNode.on('onWalletDisconnected', () => {
                console.log('Wallet desconectada desde extensión');
                this.disconnect();
            });

            window.DogeNode.on('onWithdrawal', (data) => {
                console.log('Retiro desde extensión:', data);
                // Actualizar UI
                if (typeof App !== 'undefined') {
                    App.updateStats();
                    App.loadTransactions();
                }
            });
        }
    },

    getInfo() {
        return {
            connected: this.connected,
            address: this.address,
            type: this.type,
            userId: this.userId,
            formattedAddress: this.address ? Utils.formatAddress(this.address) : null
        };
    }
};

// Inicializar wallet al cargar
document.addEventListener('DOMContentLoaded', () => {
    Wallet.initialize();
    
    // Verificar extensión periódicamente
    setInterval(() => {
        Wallet.checkExtension();
    }, 3000);
});

// Escuchar cuando la extensión esté lista
window.addEventListener('dogenode:ready', () => {
    console.log('🔌 Extensión DogeNode lista');
    Wallet.checkExtension();
});

console.log('💳 Sistema de wallet con backend real inicializado');
