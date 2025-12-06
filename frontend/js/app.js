// Aplicación Principal con Backend Real
const App = {
    
    // Estado de minería
    mining: {
        active: false,
        startTime: null,
        uptime: 0,
        bandwidth: 0,
        earnings: 0,
        earningsInterval: null
    },

    // Intervalos
    intervals: {
        mining: null,
        uptime: null,
        sync: null,
        price: null
    },

    // Precio de DOGE (obtenido desde backend)
    dogePrice: 0.08,

    // ==================
    // INICIALIZACIÓN
    // ==================

    async init() {
        console.log('🚀 Inicializando DogeNode con backend real...');

        // Mostrar loading
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('mainApp').classList.remove('hidden');
        }, 1500);

        // Verificar conexión con backend
        await this.checkBackendConnection();

        // Cargar datos
        await this.loadUserData();
        await this.updateStats();
        await this.loadTransactions();
        await this.setupEventListeners();
        await this.setupReferralSystem();

        // Restaurar sesión de minería si existe
        const session = Storage.getSession();
        if (session.isActive) {
            this.startMining();
        }

        // Obtener precio de DOGE desde backend
        await this.updateDogePrice();

        // Sincronizar con backend periódicamente
        this.intervals.sync = setInterval(() => {
            this.syncWithBackend();
        }, 30000); // Cada 30 segundos

        // Actualizar precio periódicamente
        this.intervals.price = setInterval(() => {
            this.updateDogePrice();
        }, 60000); // Cada 60 segundos

        console.log('✅ DogeNode inicializado correctamente');
    },

    // ==================
    // CONEXIÓN CON BACKEND
    // ==================

    async checkBackendConnection() {
        try {
            const response = await api.healthCheck();
            
            if (response.success) {
                console.log('✅ Backend conectado:', api.baseURL);
                console.log('📊 Servicios disponibles:', response.services);
                
                // Mostrar notificación de servicios
                const services = Object.entries(response.services)
                    .filter(([_, status]) => status === true)
                    .map(([name]) => name);
                
                if (services.length > 0) {
                    console.log('🟢 Métodos de pago disponibles:', services.join(', '));
                }
            } else {
                throw new Error('Backend no disponible');
            }
        } catch (error) {
            console.error('❌ Error conectando con backend:', error);
            Utils.showWarning('Modo offline: Algunas funciones pueden estar limitadas');
        }
    },

    // ==================
    // SINCRONIZACIÓN
    // ==================

    async syncWithBackend() {
        if (!Wallet.connected || !Wallet.userId) return;

        try {
            // Sincronizar a través del wallet
            await Wallet.syncWithBackend();
            
            // Actualizar estadísticas visuales
            this.updateStats();

        } catch (error) {
            console.error('Error en sincronización:', error);
        }
    },

    // ==================
    // DATOS DE USUARIO
    // ==================

    async loadUserData() {
        const user = Storage.getUser();
        
        // Resetear ganancias del día si es necesario
        const lastActive = new Date(user.lastActive);
        const today = new Date();
        if (lastActive.getDate() !== today.getDate()) {
            user.todayEarnings = 0;
            Storage.saveUser(user);
        }

        // Si hay wallet conectada, sincronizar con backend
        if (Wallet.connected) {
            await Wallet.syncWithBackend();
        }

        return user;
    },

    // ==================
    // ACTUALIZAR ESTADÍSTICAS
    // ==================

    async updateStats() {
        const user = Storage.getUser();
        const session = Storage.getSession();

        // Actualizar displays principales
        Utils.setText('totalEarnings', Utils.formatDogeShort(user.totalEarnings));
        Utils.setText('availableBalance', Utils.formatDogeShort(user.balance));
        Utils.setText('todayEarnings', Utils.formatDogeShort(user.todayEarnings));
        Utils.setText('totalWithdrawals', user.totalWithdrawals);
        Utils.setText('mainBalance', Utils.formatDogeShort(user.balance));
        Utils.setText('balanceUSD', `≈ ${Utils.formatUSD(Utils.calculateDogeToUSD(user.balance, this.dogePrice))}`);

        // Actualizar stats de minería
        Utils.setText('bandwidth', session.bandwidth.toFixed(0));
        Utils.setText('uptime', Utils.formatTime(session.uptime));
        Utils.setText('referrals', user.referralCount);

        // Actualizar modal de retiro
        const modalAvailable = document.getElementById('modalAvailable');
        if (modalAvailable) {
            modalAvailable.textContent = Utils.formatDogeShort(user.balance);
        }
    },

    // ==================
    // SISTEMA DE MINERÍA CON BACKEND
    // ==================

    toggleMining() {
        if (this.mining.active) {
            this.stopMining();
        } else {
            this.startMining();
        }
    },

    startMining() {
        if (this.mining.active) return;

        // Verificar wallet conectada
        if (!Wallet.connected) {
            Utils.showWarning('Conecta tu wallet primero para comenzar a ganar');
            return;
        }

        this.mining.active = true;
        this.mining.startTime = Date.now();

        const session = Storage.getSession();
        session.isActive = true;
        session.startedAt = new Date().toISOString();
        Storage.saveSession(session);

        // Actualizar UI
        const button = document.getElementById('miningToggle');
        const text = document.getElementById('miningText');
        const status = document.getElementById('miningStatus');

        button.classList.add('active');
        text.textContent = 'Detener Minería';
        status.classList.remove('hidden');

        // Iniciar contadores
        this.intervals.mining = setInterval(() => {
            this.processMining();
        }, 5000); // Cada 5 segundos enviar al backend

        this.intervals.uptime = setInterval(() => {
            this.updateUptime();
        }, 1000);

        Utils.showSuccess('¡Minería iniciada! Comenzando a ganar DOGE real...');
    },

    stopMining() {
        if (!this.mining.active) return;

        this.mining.active = false;

        const session = Storage.getSession();
        session.isActive = false;
        Storage.saveSession(session);

        // Limpiar intervalos
        if (this.intervals.mining) clearInterval(this.intervals.mining);
        if (this.intervals.uptime) clearInterval(this.intervals.uptime);

        // Actualizar UI
        const button = document.getElementById('miningToggle');
        const text = document.getElementById('miningText');
        const status = document.getElementById('miningStatus');

        button.classList.remove('active');
        text.textContent = 'Comenzar a Ganar';
        status.classList.add('hidden');

        Utils.showInfo('Minería detenida');
    },

    async processMining() {
        const user = Storage.getUser();
        const session = Storage.getSession();

        // Generar ganancias aleatorias (0.1 - 0.5 DOGE cada 5 segundos)
        const earning = Utils.random(0.1, 0.5);
        
        // Enviar ganancias al backend
        const success = await Wallet.addEarnings(earning, 'mining');
        
        if (success) {
            // Actualizar bandwidth simulado
            const bandwidth = Utils.random(50, 150);
            session.bandwidth += bandwidth;
            Storage.saveSession(session);

            // Actualizar stats visuales
            this.updateStats();
        } else {
            console.warn('⚠️ No se pudieron registrar las ganancias en el backend');
            // En caso de error, guardar localmente
            user.balance += earning;
            user.totalEarnings += earning;
            user.todayEarnings += earning;
            Storage.saveUser(user);
            Storage.addEarning(earning, 'mining');
            this.updateStats();
        }
    },

    updateUptime() {
        const session = Storage.getSession();
        session.uptime += 1;
        Storage.saveSession(session);

        Utils.setText('uptime', Utils.formatTime(session.uptime));
    },

    // ==================
    // TRANSACCIONES
    // ==================

    async loadTransactions() {
        // Intentar cargar del backend primero
        if (Wallet.connected && Wallet.userId) {
            try {
                const response = await api.getTransactions(Wallet.userId, {
                    limit: 10
                });

                if (response.success && response.data.transactions.length > 0) {
                    this.renderTransactions(response.data.transactions);
                    return;
                }
            } catch (error) {
                console.error('Error cargando transacciones del backend:', error);
            }
        }

        // Fallback: cargar del localStorage
        const transactions = Storage.getTransactions();
        this.renderTransactions(transactions.slice(0, 10));
    },

    renderTransactions(transactions) {
        const container = document.getElementById('transactionsList');

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <i class="fas fa-inbox text-6xl mb-4"></i>
                    <p>No hay transacciones todavía</p>
                    <p class="text-sm mt-2">Comienza a minar para ver tus ganancias aquí</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(tx => `
            <div class="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition border-b border-gray-100 last:border-0">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 ${tx.type === 'withdrawal' ? 'bg-red-100' : 'bg-green-100'} rounded-full flex items-center justify-center">
                        <i class="fas ${tx.type === 'withdrawal' ? 'fa-arrow-up text-red-500' : 'fa-coins text-green-500'} text-xl"></i>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800">
                            ${tx.type === 'withdrawal' ? 'Retiro' : tx.type === 'earning' ? 'Ganancia' : 'Transacción'}
                        </p>
                        <p class="text-sm text-gray-500">${Utils.formatDateShort(tx.createdAt || tx.timestamp)}</p>
                        ${tx.txHash ? <p class="text-xs text-gray-400 font-mono">${tx.txHash.substring(0, 16)}...</p> : ''}
${tx.status === 'pending' ? '<p class="text-xs text-yellow-600">Procesando...</p>' : ''}
</div>
</div>
<div class="text-right">
<p class="font-bold ${tx.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}">
${tx.type === 'withdrawal' ? '-' : '+'} ${Utils.formatDogeShort(tx.amount || tx.netAmount)} DOGE
</p>
<span class="inline-block px-2 py-1 text-xs rounded ${
                     tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                     tx.status === 'pending' || tx.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                     'bg-red-100 text-red-700'
                 }">
${tx.status === 'completed' ? 'Completado' :
tx.status === 'pending' ? 'Pendiente' :
tx.status === 'processing' ? 'Procesando' : 'Fallido'}
</span>
${tx.explorerUrl ?                         <a href="${tx.explorerUrl}" target="_blank" class="block text-xs text-blue-500 hover:text-blue-600 mt-1">                             Ver en explorer <i class="fas fa-external-link-alt"></i>                         </a>                     : ''}
</div>
</div>
`).join('');
},
// ==================
// SISTEMA DE REFERIDOS
// ==================

async setupReferralSystem() {
    if (!Wallet.userId) return;

    const referrals = Storage.getReferrals();
    const referralLink = `${window.location.origin}${window.location.pathname}?ref=${referrals.code}`;
    
    const linkInput = document.getElementById('referralLink');
    const modalLinkInput = document.getElementById('modalReferralLink');
    
    if (linkInput) linkInput.value = referralLink;
    if (modalLinkInput) modalLinkInput.value = referralLink;

    // Verificar si viene por referido
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode && refCode !== referrals.code) {
        console.log('Usuario referido por:', refCode);
        Storage.set('referredBy', refCode);
        
        // Aquí podrías registrar el referido en el backend
        // await api.registerReferral(Wallet.userId, refCode);
    }
},

// ==================
// ACTUALIZAR PRECIO DE DOGE
// ==================

async updateDogePrice() {
    try {
        const response = await api.getDogePrice();
        
        if (response.success) {
            this.dogePrice = response.data.price;
            console.log(`💰 Precio de DOGE actualizado: $${this.dogePrice}`);
            this.updateStats();
        }
    } catch (error) {
        console.error('Error actualizando precio de DOGE:', error);
        // Usar precio por defecto
        this.dogePrice = 0.08;
    }
},

// ==================
// EVENT LISTENERS
// ==================

setupEventListeners() {
    // Eventos ya configurados en las funciones globales
    console.log('✅ Event listeners configurados');
}
    };
// ==================
// FUNCIONES GLOBALES
// ==================
function toggleMining() {
App.toggleMining();
}
async function openWithdrawModal() {
if (!Wallet.connected) {
Utils.showError('Debes conectar tu wallet primero');
    // Ofrecer conectar wallet
    if (confirm('¿Quieres conectar tu wallet ahora?')) {
        await Wallet.connect('dogecore');
    }
    return;
}

const modal = document.getElementById('withdrawModal');
modal.classList.add('active');
    }
function closeWithdrawModal() {
const modal = document.getElementById('withdrawModal');
modal.classList.remove('active');
document.getElementById('withdrawAddress').value = '';
document.getElementById('withdrawAmount').value = '';
}
async function processWithdraw(event) {
event.preventDefault();
    const address = document.getElementById('withdrawAddress').value.trim();
const amount = parseFloat(document.getElementById('withdrawAmount').value);

if (!Utils.isValidDogeAddress(address)) {
    Utils.showError('Dirección de Dogecoin inválida');
    return;
}

if (!Utils.isValidAmount(amount) || amount < 10) {
    Utils.showError('Cantidad inválida. Mínimo 10 DOGE');
    return;
}

const user = Storage.getUser();
if (user.balance < amount) {
    Utils.showError('Saldo insuficiente');
    return;
}

// Confirmar retiro
const estimateResponse = await api.estimateWithdrawal(amount);

if (estimateResponse.success) {
    const estimate = estimateResponse.data;
    const confirmMessage = `
    ¿Confirmas el retiro?
Cantidad: ${amount} DOGE
Fee: ${estimate.fee} DOGE
Total: ${estimate.totalAmount} DOGE
Recibirás: ${estimate.youWillReceive} DOGE
Tiempo estimado: ${estimate.estimatedTime}
`;
    if (!confirm(confirmMessage)) {
        return;
    }
}

// Procesar retiro con backend real
const success = await Wallet.withdraw(address, amount);

if (success) {
    closeWithdrawModal();
}
    }
function openReferralModal() {
const modal = document.getElementById('referralModal');
modal.classList.add('active');
}
function closeReferralModal() {
const modal = document.getElementById('referralModal');
modal.classList.remove('active');
}
function copyReferralLink() {
const input = document.getElementById('referralLink');
Utils.copyToClipboard(input.value);
}
function copyModalReferralLink() {
const input = document.getElementById('modalReferralLink');
Utils.copyToClipboard(input.value);
}
function shareTwitter() {
const link = document.getElementById('modalReferralLink').value;
const text = '¡Únete a DogeNode y gana Dogecoin real compartiendo tu ancho de banda! 🐕💰';
Utils.shareTwitter(text, link);
}
function shareFacebook() {
const link = document.getElementById('modalReferralLink').value;
Utils.shareFacebook(link);
}
function shareWhatsApp() {
const link = document.getElementById('modalReferralLink').value;
const text = '¡Únete a DogeNode y gana Dogecoin real! 🐕💰';
Utils.shareWhatsApp(text, link);
}
function viewAllTransactions() {
// Redirigir a página de transacciones o mostrar modal
if (Wallet.connected) {
window.open(#transactions, '_self');
App.loadTransactions();
} else {
Utils.showInfo('Conecta tu wallet para ver el historial completo');
}
}
async function manageWallet() {
if (Wallet.connected) {
if (confirm('¿Deseas desconectar tu wallet?')) {
Wallet.disconnect();
}
} else {
// Mostrar opciones de wallet
const walletType = prompt('Selecciona tu wallet:\n1. Dogecoin Core\n2. MetaMask\n\nIngresa 1 o 2:');
    if (walletType === '1') {
        await Wallet.connect('dogecore');
    } else if (walletType === '2') {
        await Wallet.connect('metamask');
    }
}
}
function showExtensionInstructions() {
const instructions = `
📥 Instrucciones de Instalación de la Extensión:

Descarga los archivos de la extensión
Abre Chrome y ve a chrome://extensions
Activa "Modo de desarrollador"
Haz clic en "Cargar extensión sin empaquetar"
Selecciona la carpeta dogenode-extension
¡Listo! Recarga esta página

La extensión te permite:
✅ Gestionar múltiples wallets
✅ Procesar retiros más rápido
✅ Recibir notificaciones
✅ Sincronización automática
¿Quieres ver las instrucciones completas?
`;
if (confirm(instructions)) {
    window.open('https://github.com/tu-usuario/dogenode-extension', '_blank');
}
}
// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
const withdrawModal = document.getElementById('withdrawModal');
const referralModal = document.getElementById('referralModal');
if (event.target === withdrawModal) {
    closeWithdrawModal();
}
if (event.target === referralModal) {
    closeReferralModal();
}
};
// ==================
// INICIALIZAR APP
// ==================
document.addEventListener('DOMContentLoaded', () => {
App.init();
});
// Cleanup al cerrar la página
window.addEventListener('beforeunload', () => {
// Limpiar intervalos
Object.values(App.intervals).forEach(interval => {
if (interval) clearInterval(interval);
});
});
console.log('🎮 Aplicación con backend real cargada');

---

## 📄 **Archivo 4: Actualizar `index.html`** (Agregar script de API)

Agrega esto en tu `index.html` ANTES de los otros scripts:
```html
<!-- Scripts -->
<script src="js/api.js"></script>
<script src="js/storage.js"></script>
<script src="js/utils.js"></script>
<script src="js/wallet.js"></script>
<script src="js/app.js"></script>
```

---

## 📄 **Archivo 5: `frontend/config.js`** (Configuración del frontend)
```javascript
// Configuración del Frontend
const CONFIG = {
    // URL del backend (cambiar en producción)
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://tu-backend-produccion.herokuapp.com',
    
    // Configuración de la aplicación
    APP_NAME: 'DogeNode',
    APP_VERSION: '2.0.0',
    
    // Configuración de minería
    MINING: {
        MIN_EARNING: 0.1,
        MAX_EARNING: 0.5,
        INTERVAL: 5000, // 5 segundos
        MIN_BALANCE_TO_WITHDRAW: 10
    },
    
    // Configuración de UI
    UI: {
        TOAST_DURATION: 5000,
        SYNC_INTERVAL: 30000, // 30 segundos
        PRICE_UPDATE_INTERVAL: 60000 // 1 minuto
    },
    
    // URLs
    URLS: {
        EXPLORER: 'https://dogechain.info/tx/',
        BSC_EXPLORER: 'https://bscscan.com/tx/',
        GITHUB: 'https://github.com/tu-usuario/dogenode',
        TWITTER: 'https://twitter.com/dogenode',
        DISCORD: 'https://discord.gg/dogenode'
    },
    
    // Features
    FEATURES: {
        REAL_PAYMENTS: true,
        REFERRAL_SYSTEM: true,
        AUTO_WITHDRAW: false,
        NOTIFICATIONS: true
    }
};

// Exportar configuración
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

console.log('⚙️ Configuración cargada:', CONFIG.APP_NAME, CONFIG.APP_VERSION);
```

---

## 📄 **Archivo 6: Script de Setup Completo**

### **`setup-production.sh`**
```bash
#!/bin/bash

echo "=========================================="
echo "🚀 Setup de Producción - DogeNode"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

echo "📋 Este script configurará:"
echo "   1. Backend en servidor"
echo "   2. MongoDB"
echo "   3. Dogecoin Node (opcional)"
echo "   4. Smart Contract (opcional)"
echo "   5. Frontend en GitHub Pages"
echo ""

read -p "¿Continuar? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    print_error "Setup cancelado"
    exit 0
fi

# ==================
# 1. BACKEND
# ==================
echo ""
echo "========================================"
echo "📦 BACKEND SETUP"
echo "========================================"
echo ""

cd backend

# Verificar Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js no instalado"
    echo "Instala Node.js: https://nodejs.org/"
    exit 1
fi

print_success "Node.js $(node --version)"

# Instalar dependencias
print_warning "Instalando dependencias..."
npm install

if [ $? -eq 0 ]; then
    print_success "Dependencias instaladas"
else
    print_error "Error instalando dependencias"
    exit 1
fi

# Configurar .env
if [ ! -f .env ]; then
    print_warning "Creando archivo .env..."
    cp .env.example .env
    
    echo ""
    print_warning "IMPORTANTE: Edita el archivo .env con tus credenciales"
    print_warning "Presiona ENTER cuando hayas terminado..."
    read
fi

# Verificar MongoDB
print_warning "Verificando MongoDB..."
if command -v mongod &> /dev/null; then
    print_success "MongoDB instalado"
else
    print_warning "MongoDB no detectado"
    echo "¿Quieres instalar MongoDB? (yes/no):"
    read install_mongo
    
    if [ "$install_mongo" == "yes" ]; then
        # Instrucciones de instalación según OS
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "Instalando MongoDB en Linux..."
            wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
            echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
            sudo apt-get update
            sudo apt-get install -y mongodb-org
            sudo systemctl start mongod
            sudo systemctl enable mongod
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            echo "Instalando MongoDB en macOS..."
            brew tap mongodb/brew
            brew install mongodb-community
            brew services start mongodb-community
        fi
    fi
fi

# ==================
# 2. DOGECOIN NODE (OPCIONAL)
# ==================
echo ""
echo "========================================"
echo "🐕 DOGECOIN NODE SETUP"
echo "========================================"
echo ""

read -p "¿Quieres configurar un nodo de Dogecoin? (yes/no): " setup_node

if [ "$setup_node" == "yes" ]; then
    cd ../scripts
    chmod +x setup-dogecoin-node.sh
    ./setup-dogecoin-node.sh
    cd ../backend
fi

# ==================
# 3. SMART CONTRACT (OPCIONAL)
# ==================
echo ""
echo "========================================"
echo "💎 SMART CONTRACT SETUP"
echo "========================================"
echo ""

read -p "¿Quieres deployar el smart contract de wDOGE? (yes/no): " deploy_contract

if [ "$deploy_contract" == "yes" ]; then
    print_warning "Instalando Truffle..."
    npm install -g truffle
    
    cd ../contracts
    
    print_warning "Inicializando proyecto Truffle..."
    truffle init
    
    print_warning "Copia el contrato WrappedDoge.sol a contracts/"
    print_warning "Configura truffle-config.js con tu red BSC"
    print_warning "Presiona ENTER cuando estés listo para deployar..."
    read
    
    truffle compile
    
    cd ../backend
    node scripts/deploy-contract.js
fi

# ==================
# 4. INICIAR BACKEND
# ==================
echo ""
echo "========================================"
echo "🚀 INICIANDO BACKEND"
echo "========================================"
echo ""

# Verificar servicios
node scripts/verify-services.js

if [ $? -eq 0 ]; then
    print_success "Todos los servicios verificados"
    
    echo ""
    print_warning "¿Cómo quieres iniciar el backend?"
    echo "1. Desarrollo (nodemon)"
    echo "2. Producción (node)"
    echo "3. PM2 (recomendado para producción)"
    read -p "Selecciona (1/2/3): " start_mode
    
    case $start_mode in
        1)
            print_success "Iniciando en modo desarrollo..."
            npm run dev
            ;;
        2)
            print_success "Iniciando en modo producción..."
            NODE_ENV=production npm start
            ;;
        3)
            if ! command -v pm2 &> /dev/null; then
                print_warning "Instalando PM2..."
                npm install -g pm2
            fi
            
            print_success "Iniciando con PM2..."
            pm2 start server.js --name "dogenode-backend"
            pm2 save
            pm2 startup
            
            print_success "Backend corriendo con PM2"
            echo "Comandos útiles:"
            echo "  pm2 status          - Ver estado"
            echo "  pm2 logs dogenode   - Ver logs"
            echo "  pm2 restart dogenode - Reiniciar"
            echo "  pm2 stop dogenode   - Detener"
            ;;
        *)
            print_error "Opción inválida"
            ;;
    esac
else
    print_error "Algunos servicios tienen problemas"
    print_warning "Revisa la configuración antes de continuar"
fi

# ==================
# 5. FRONTEND
# ==================
echo ""
echo "========================================"
echo "🎨 FRONTEND SETUP"
echo "========================================"
echo ""

cd ../frontend

print_warning "Para deployar el frontend:"
echo ""
echo "1. Sube los archivos a tu repositorio GitHub:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo "   git remote add origin https://github.com/tu-usuario/dogenode.git"
echo "   git push -u origin main"
echo ""
echo "2. Activa GitHub Pages:"
echo "   - Ve a Settings → Pages"
echo "   - Source: Deploy from branch"
echo "   - Branch: main / root"
echo "   - Save"
echo ""
echo "3. Actualiza la URL del backend en js/api.js:"
echo "   baseURL: 'https://tu-backend.herokuapp.com'"
echo ""

print_success "Setup completo!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Verifica que el backend esté corriendo"
echo "2. Configura el frontend con la URL del backend"
echo "3. Sube el frontend a GitHub Pages"
echo "4. ¡Comienza a ganar DOGE real!"
```

---

## 📄 **Archivo 7: README de Integración**

### **`INTEGRATION.md`**
```markdown
# 🔗 Guía de Integración Frontend-Backend

## Resumen

Esta guía explica cómo conectar el frontend (GitHub Pages) con el backend (Node.js) para procesar pagos reales de Dogecoin.

## Arquitectura
```
┌─────────────────┐      HTTPS      ┌──────────────────┐
│                 │ ◄─────────────► │                  │
│  Frontend       │                 │  Backend API     │
│  (GitHub Pages) │                 │  (Node.js)       │
│                 │                 │                  │
└─────────────────┘                 └──────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
            ┌───────▼──────┐       ┌───────▼──────┐       ┌───────▼──────┐
            │              │       │              │       │              │
            │  MongoDB     │       │  Dogecoin    │       │  BSC Network │
            │              │       │  Node        │       │  (wDOGE)     │
            └──────────────┘       └──────────────┘       └──────────────┘
