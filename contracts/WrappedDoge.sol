// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title WrappedDoge
 * @dev Token ERC20 que representa Dogecoin en Binance Smart Chain
 */
contract WrappedDoge is ERC20, Ownable, Pausable {
    
    // Eventos
    event Mint(address indexed to, uint256 amount, string dogeAddress);
    event Burn(address indexed from, uint256 amount, string dogeAddress);
    event BridgeTransfer(address indexed from, uint256 amount, string toDogeAddress);
    
    // Mapeo de direcciones autorizadas para mint
    mapping(address => bool) public minters;
    
    // Mapeo de transacciones procesadas (para evitar doble gasto)
    mapping(bytes32 => bool) public processedTransactions;
    
    // Tasa de conversión (por defecto 1:1)
    uint256 public conversionRate = 1e18;
    
    // Fee de bridge (en basis points, 100 = 1%)
    uint256 public bridgeFee = 100; // 1%
    
    // Address del treasury para fees
    address public treasury;
    
    constructor() ERC20("Wrapped Dogecoin", "wDOGE") {
        treasury = msg.sender;
    }
    
    /**
     * @dev Modificador para verificar si el caller es un minter autorizado
     */
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "No autorizado para mint");
        _;
    }
    
    /**
     * @dev Agregar un minter autorizado
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Direccion invalida");
        minters[minter] = true;
    }
    
    /**
     * @dev Remover un minter autorizado
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
    }
    
    /**
     * @dev Actualizar el treasury
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Direccion invalida");
        treasury = _treasury;
    }
    
    /**
     * @dev Actualizar el bridge fee
     */
    function setBridgeFee(uint256 _bridgeFee) external onlyOwner {
        require(_bridgeFee <= 1000, "Fee muy alto"); // Max 10%
        bridgeFee = _bridgeFee;
    }
    
    /**
     * @dev Mintear tokens cuando se recibe DOGE
     * @param to Dirección que recibirá los tokens
     * @param amount Cantidad de tokens a mintear
     * @param dogeAddress Dirección de Dogecoin del depositante
     * @param dogeTxHash Hash de la transacción de Dogecoin
     */
    function mint(
        address to,
        uint256 amount,
        string memory dogeAddress,
        string memory dogeTxHash
    ) external onlyMinter whenNotPaused {
        require(to != address(0), "Direccion invalida");
        require(amount > 0, "Cantidad debe ser mayor a 0");
        
        // Verificar que la transacción no haya sido procesada
        bytes32 txHash = keccak256(abi.encodePacked(dogeTxHash));
        require(!processedTransactions[txHash], "Transaccion ya procesada");
        
        // Marcar transacción como procesada
        processedTransactions[txHash] = true;
        
        // Mintear tokens
        _mint(to, amount);
        
        emit Mint(to, amount, dogeAddress);
    }
    
    /**
     * @dev Quemar tokens para recibir DOGE
     * @param amount Cantidad de tokens a quemar
     * @param dogeAddress Dirección de Dogecoin donde se enviarán los DOGE
     */
    function burn(uint256 amount, string memory dogeAddress) external whenNotPaused {
        require(amount > 0, "Cantidad debe ser mayor a 0");
        require(bytes(dogeAddress).length > 0, "Direccion de DOGE requerida");
        require(balanceOf(msg.sender) >= amount, "Saldo insuficiente");
        
        // Calcular fee
        uint256 fee = (amount * bridgeFee) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        // Quemar tokens del usuario
        _burn(msg.sender, amount);
        
        // Mintear fee al treasury
        if (fee > 0) {
            _mint(treasury, fee);
        }
        
        emit Burn(msg.sender, amountAfterFee, dogeAddress);
        emit BridgeTransfer(msg.sender, amountAfterFee, dogeAddress);
    }
    
    /**
     * @dev Pausar el contrato
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Despausar el contrato
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Override de decimals para usar 8 decimales como Dogecoin
     */
    function decimals() public pure override returns (uint8) {
        return 8;
    }
    
    /**
     * @dev Verificar si una transacción fue procesada
     */
    function isTransactionProcessed(string memory dogeTxHash) external view returns (bool) {
        bytes32 txHash = keccak256(abi.encodePacked(dogeTxHash));
        return processedTransactions[txHash];
    }
    
    /**
     * @dev Calcular el fee para una cantidad dada
     */
    function calculateFee(uint256 amount) external view returns (uint256) {
        return (amount * bridgeFee) / 10000;
    }
    
    /**
     * @dev Recuperar tokens ERC20 enviados por error
     */
    function recoverERC20(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(this), "No se puede recuperar wDOGE");
IERC20(tokenAddress).transfer(owner(), amount);
}
/**
 * @dev Recuperar BNB enviados al contrato
 */
function recoverBNB() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
}
}
---

## 📄 **Archivo 15: Scripts de Deployment**

### **`scripts/deploy.sh`** (Linux/Mac)
```bash
#!/bin/bash

echo "======================================"
echo "🚀 DogeNode Backend Deployment Script"
echo "======================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Verificar Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado"
    exit 1
fi

print_success "Node.js $(node --version) detectado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    print_error "npm no está instalado"
    exit 1
fi

print_success "npm $(npm --version) detectado"

# Instalar dependencias
echo ""
echo "📦 Instalando dependencias..."
npm install

if [ $? -eq 0 ]; then
    print_success "Dependencias instaladas"
else
    print_error "Error instalando dependencias"
    exit 1
fi

# Verificar archivo .env
echo ""
if [ ! -f .env ]; then
    print_warning "Archivo .env no encontrado"
    echo "📝 Creando archivo .env desde .env.example..."
    cp .env.example .env
    print_warning "Por favor edita el archivo .env con tus credenciales"
    exit 0
fi

print_success "Archivo .env encontrado"

# Verificar MongoDB
echo ""
echo "🔍 Verificando conexión a MongoDB..."
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dogenode')
  .then(() => {
    console.log('✅ MongoDB conectado');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  });
"

if [ $? -ne 0 ]; then
    print_error "No se pudo conectar a MongoDB"
    print_warning "Asegúrate de que MongoDB esté corriendo"
    exit 1
fi

# Verificar servicios opcionales
echo ""
echo "🔧 Verificando servicios opcionales..."

# Dogecoin Node
if [ "$DOGECOIN_NODE_ENABLED" = "true" ]; then
    print_warning "Verificar manualmente Dogecoin Node en $DOGECOIN_HOST:$DOGECOIN_PORT"
else
    print_warning "Dogecoin Node deshabilitado"
fi

# Wrapped DOGE
if [ "$WRAPPED_DOGE_ENABLED" = "true" ]; then
    print_success "Wrapped DOGE habilitado"
else
    print_warning "Wrapped DOGE deshabilitado"
fi

# Iniciar servidor
echo ""
echo "🚀 Iniciando servidor..."
echo ""

if [ "$1" = "production" ]; then
    print_success "Iniciando en modo PRODUCCIÓN"
    NODE_ENV=production npm start
elif [ "$1" = "dev" ]; then
    print_success "Iniciando en modo DESARROLLO"
    npm run dev
else
    print_success "Iniciando servidor..."
    npm start
fi
```

### **`scripts/deploy.bat`** (Windows)
```batch
@echo off
echo ======================================
echo 🚀 DogeNode Backend Deployment Script
echo ======================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado
    exit /b 1
)

echo ✅ Node.js detectado
node --version

REM Verificar npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm no está instalado
    exit /b 1
)

echo ✅ npm detectado
npm --version

REM Instalar dependencias
echo.
echo 📦 Instalando dependencias...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias
    exit /b 1
)

echo ✅ Dependencias instaladas

REM Verificar .env
echo.
if not exist .env (
    echo ⚠️  Archivo .env no encontrado
    echo 📝 Creando archivo .env desde .env.example...
    copy .env.example .env
    echo ⚠️  Por favor edita el archivo .env con tus credenciales
    pause
    exit /b 0
)

echo ✅ Archivo .env encontrado

REM Iniciar servidor
echo.
echo 🚀 Iniciando servidor...
echo.

if "%1"=="production" (
    echo ✅ Iniciando en modo PRODUCCIÓN
    set NODE_ENV=production
    npm start
) else if "%1"=="dev" (
    echo ✅ Iniciando en modo DESARROLLO
    npm run dev
) else (
    echo ✅ Iniciando servidor...
    npm start
)
```

---

## 📄 **Archivo 16: `scripts/setup-dogecoin-node.sh`**
```bash
#!/bin/bash

echo "======================================"
echo "🐕 Configuración de Dogecoin Core Node"
echo "======================================"
echo ""

# Verificar sistema operativo
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Sistema: Linux"
    DOGECOIN_URL="https://github.com/dogecoin/dogecoin/releases/download/v1.14.6/dogecoin-1.14.6-x86_64-linux-gnu.tar.gz"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Sistema: macOS"
    DOGECOIN_URL="https://github.com/dogecoin/dogecoin/releases/download/v1.14.6/dogecoin-1.14.6-osx64.tar.gz"
else
    echo "❌ Sistema operativo no soportado"
    exit 1
fi

# Crear directorio
mkdir -p ~/dogecoin
cd ~/dogecoin

# Descargar Dogecoin Core
echo ""
echo "📥 Descargando Dogecoin Core..."
wget $DOGECOIN_URL -O dogecoin.tar.gz

# Extraer
echo "📦 Extrayendo..."
tar -xzf dogecoin.tar.gz
rm dogecoin.tar.gz

# Crear directorio de configuración
mkdir -p ~/.dogecoin

# Crear archivo de configuración
echo "⚙️  Creando archivo de configuración..."

cat > ~/.dogecoin/dogecoin.conf << EOF
# Configuración de Dogecoin Core para DogeNode

# Red
testnet=0
mainnet=1

# RPC
server=1
rpcuser=dogecoinrpc
rpcpassword=$(openssl rand -hex 32)
rpcallowip=127.0.0.1
rpcport=22555

# Wallet
disablewallet=0

# Conexión
maxconnections=125
addnode=seed.multidoge.org
addnode=seed2.multidoge.org

# Logging
debug=0
printtoconsole=0

# Performance
dbcache=300
maxmempool=300
EOF

echo "✅ Configuración creada en ~/.dogecoin/dogecoin.conf"
echo ""
echo "🔑 Credenciales RPC:"
echo "Usuario: dogecoinrpc"
echo "Password: $(grep rpcpassword ~/.dogecoin/dogecoin.conf | cut -d'=' -f2)"
echo ""
echo "📝 IMPORTANTE: Guarda estas credenciales en tu archivo .env"
echo ""

# Crear script de inicio
cat > ~/dogecoin/start-node.sh << 'EOF'
#!/bin/bash
echo "🚀 Iniciando Dogecoin Node..."
cd ~/dogecoin/dogecoin-*/bin
./dogecoind -daemon
echo "✅ Nodo iniciado"
echo "📊 Verifica el estado con: ./dogecoin-cli getblockchaininfo"
EOF

chmod +x ~/dogecoin/start-node.sh

# Crear script de detención
cat > ~/dogecoin/stop-node.sh << 'EOF'
#!/bin/bash
echo "🛑 Deteniendo Dogecoin Node..."
cd ~/dogecoin/dogecoin-*/bin
./dogecoin-cli stop
echo "✅ Nodo detenido"
EOF

chmod +x ~/dogecoin/stop-node.sh

echo "✅ Scripts de control creados:"
echo "   - Iniciar: ~/dogecoin/start-node.sh"
echo "   - Detener: ~/dogecoin/stop-node.sh"
echo ""
echo "🎉 Instalación completada!"
echo ""
echo "📖 Próximos pasos:"
echo "1. Copia las credenciales RPC a tu archivo .env"
echo "2. Inicia el nodo: ~/dogecoin/start-node.sh"
echo "3. Espera a que sincronice (puede tomar varias horas)"
echo "4. Verifica el estado: cd ~/dogecoin/dogecoin-*/bin && ./dogecoin-cli getblockchaininfo"
```

---

## 📄 **Archivo 17: `scripts/deploy-contract.js`**
```javascript
const { Web3 } = require('web3');
const fs = require('fs');
require('dotenv').config();

// Configuración
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const CONTRACT_PATH = './contracts/build/WrappedDoge.json';

async function deployContract() {
    console.log('====================================');
    console.log('🚀 Deployment de Smart Contract');
    console.log('====================================\n');

    // Verificar clave privada
    if (!PRIVATE_KEY) {
        console.error('❌ WALLET_PRIVATE_KEY no está configurada en .env');
        process.exit(1);
    }

    // Inicializar Web3
    const web3 = new Web3(RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);

    console.log('📍 Network:', RPC_URL);
    console.log('👤 Deployer:', account.address);

    // Verificar balance
    const balance = await web3.eth.getBalance(account.address);
    const balanceBNB = web3.utils.fromWei(balance, 'ether');
    console.log('💰 Balance:', balanceBNB, 'BNB\n');

    if (parseFloat(balanceBNB) < 0.01) {
        console.error('❌ Balance insuficiente para deployment');
        console.error('   Necesitas al menos 0.01 BNB');
        process.exit(1);
    }

    // Leer contrato compilado
    if (!fs.existsSync(CONTRACT_PATH)) {
        console.error('❌ Contrato compilado no encontrado');
        console.error('   Ejecuta: truffle compile');
        process.exit(1);
    }

    const contractJSON = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
    const abi = contractJSON.abi;
    const bytecode = contractJSON.bytecode;

    console.log('📄 Contrato cargado');
    console.log('📦 Deploying...\n');

    // Crear contrato
    const contract = new web3.eth.Contract(abi);

    try {
        // Deploy
        const deployment = contract.deploy({
            data: bytecode,
            arguments: [] // Constructor sin argumentos
        });

        // Estimar gas
        const gasEstimate = await deployment.estimateGas({
            from: account.address
        });

        console.log('⛽ Gas estimado:', gasEstimate);

        // Obtener precio de gas
        const gasPrice = await web3.eth.getGasPrice();
        console.log('💵 Gas price:', web3.utils.fromWei(gasPrice, 'gwei'), 'Gwei');

        // Calcular costo
        const cost = (BigInt(gasEstimate) * BigInt(gasPrice));
        const costBNB = web3.utils.fromWei(cost.toString(), 'ether');
        console.log('💸 Costo estimado:', costBNB, 'BNB\n');

        // Confirmar deployment
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('¿Continuar con el deployment? (yes/no): ', async (answer) => {
            readline.close();

            if (answer.toLowerCase() !== 'yes') {
                console.log('❌ Deployment cancelado');
                process.exit(0);
            }

            console.log('\n🚀 Deploying contract...\n');

            // Enviar transacción
            const deployedContract = await deployment.send({
                from: account.address,
                gas: Math.floor(gasEstimate * 1.2), // 20% extra
                gasPrice: gasPrice
            });

            console.log('✅ Contrato deployado!');
            console.log('📍 Dirección:', deployedContract.options.address);
            console.log('🔗 BSCScan:', `https://bscscan.com/address/${deployedContract.options.address}`);
            console.log('\n📝 Actualiza tu .env:');
            console.log(`WDOGE_CONTRACT=${deployedContract.options.address}`);

            // Guardar información del deployment
            const deploymentInfo = {
                address: deployedContract.options.address,
                deployer: account.address,
                network: RPC_URL.includes('testnet') ? 'BSC Testnet' : 'BSC Mainnet',
                timestamp: new Date().toISOString(),
                txHash: deployedContract.options.transactionHash
            };

            fs.writeFileSync(
                './deployment.json',
                JSON.stringify(deploymentInfo, null, 2)
            );

            console.log('💾 Información guardada en deployment.json\n');
            console.log('====================================');
        });

    } catch (error) {
        console.error('❌ Error en deployment:', error.message);
        process.exit(1);
    }
}

// Ejecutar
deployContract().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
```

---

## 📄 **Archivo 18: `scripts/verify-services.js`**
```javascript
require('dotenv').config();
const config = require('../config/config');

async function verifyServices() {
    console.log('====================================');
    console.log('🔍 Verificación de Servicios');
    console.log('====================================\n');

    const results = {
        mongodb: false,
        dogecoinNode: false,
        dogechainAPI: false,
        wrappedDoge: false
    };

    // Verificar MongoDB
    console.log('📊 MongoDB...');
    try {
        const mongoose = require('mongoose');
        await mongoose.connect(config.mongodb.uri);
        results.mongodb = true;
        console.log('✅ MongoDB: Conectado');
        await mongoose.connection.close();
    } catch (error) {
        console.log('❌ MongoDB: Error -', error.message);
    }

    // Verificar Dogecoin Node
    console.log('\n🐕 Dogecoin Node...');
    if (config.dogecoin.enabled) {
        try {
            const dogecoinNode = require('../services/dogecoinNode');
            if (dogecoinNode.isAvailable()) {
                const info = await dogecoinNode.getNodeInfo();
                results.dogecoinNode = true;
                console.log('✅ Dogecoin Node: Conectado');
                console.log(`   - Bloques: ${info.blockchain.blocks}`);
                console.log(`   - Conexiones: ${info.network.connections}`);
                console.log(`   - Balance: ${info.wallet.balance} DOGE`);
            } else {
                console.log('❌ Dogecoin Node: No disponible');
            }
        } catch (error) {
            console.log('❌ Dogecoin Node: Error -', error.message);
        }
    } else {
        console.log('⚠️  Dogecoin Node: Deshabilitado');
    }

    // Verificar Dogechain API
    console.log('\n🔗 Dogechain API...');
    if (config.dogechain.enabled) {
        try {
            const dogechainAPI = require('../services/dogechainAPI');
            const price = await dogechainAPI.getDogecoinPrice();
            results.dogechainAPI = true;
            console.log('✅ Dogechain API: Funcionando');
            console.log(`   - Precio DOGE: $${price}`);
        } catch (error) {
            console.log('❌ Dogechain API: Error -', error.message);
        }
    } else {
        console.log('⚠️  Dogechain API: Deshabilitado');
    }

    // Verificar Wrapped DOGE
    console.log('\n💎 Wrapped DOGE (BSC)...');
    if (config.wrappedDoge.enabled) {
        try {
            const wrappedDoge = require('../services/wrappedDoge');
            if (wrappedDoge.isAvailable()) {
                const gasPrice = await wrappedDoge.getGasPrice();
                results.wrappedDoge = true;
                console.log('✅ Wrapped DOGE: Conectado');
                console.log(`   - Gas Price: ${gasPrice} Gwei`);
                console.log(`   - Contrato: ${config.wrappedDoge.contractAddress}`);
            } else {
                console.log('❌ Wrapped DOGE: No disponible');
            }
        } catch (error) {
            console.log('❌ Wrapped DOGE: Error -', error.message);
        }
    } else {
        console.log('⚠️  Wrapped DOGE: Deshabilitado');
    }

    // Resumen
    console.log('\n====================================');
    console.log('📋 Resumen:');
    console.log('====================================');
    
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(v => v).length;
    
    console.log(`✅ Servicios funcionando: ${passed}/${total}`);
    
    if (passed === total) {
        console.log('\n🎉 ¡Todos los servicios están funcionando!\n');
        process.exit(0);
    } else {
        console.log('\n⚠️  Algunos servicios tienen problemas\n');
        process.exit(1);
    }
}

verifyServices().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
```

---

## 📄 **Archivo 19: `package.json` (Actualizado con scripts)**
```json
{
  "name": "dogenode-backend-real",
  "version": "1.0.0",
  "description": "Backend real para pagos de Dogecoin",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "deploy": "bash scripts/deploy.sh",
    "deploy:prod": "bash scripts/deploy.sh production",
    "setup:node": "bash scripts/setup-dogecoin-node.sh",
    "deploy:contract": "node scripts/deploy-contract.js",
    "verify": "node scripts/verify-services.js",
    "test": "jest --coverage",
    "lint": "eslint ."
  },
  "keywords": ["dogecoin", "crypto", "payments", "blockchain"],
  "author": "DogeNode",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "express-rate-limit": "^7.1.5",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "axios": "^1.6.2",
    "bitcoin-core": "^4.2.0",
    "mongoose": "^8.0.3",
    "web3": "^4.3.0",
    "@truffle/hdwallet-provider": "^2.1.15",
    "bignumber.js": "^9.1.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "eslint": "^8.55.0"
  }
}
```

---

## 🚀 **Guía de Instalación Completa**

### **Paso 1: Preparar el entorno**
```bash
# Clonar o crear el proyecto
mkdir dogenode-backend
cd dogenode-backend

# Copiar todos los archivos del backend
# (estructura mostrada anteriormente)

# Instalar dependencias
npm install
```

### **Paso 2: Configurar MongoDB**
```bash
# Instalar MongoDB (Ubuntu/Debian)
sudo apt-get install mongodb

# O usando Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verificar
mongo --eval "db.version()"
```

### **Paso 3: Configurar Dogecoin Node (Opcional)**
```bash
# Ejecutar script de instalación
chmod +x scripts/setup-dogecoin-node.sh
./scripts/setup-dogecoin-node.sh

# Iniciar nodo
~/dogecoin/start-node.sh

# Verificar sincronización
cd ~/dogecoin/dogecoin-*/bin
./dogecoin-cli getblockchaininfo
```

### **Paso 4: Configurar .env**
```bash
# Copiar ejemplo
cp .env.example .env

# Editar con tus credenciales
nano .env
```

### **Paso 5: Deploy del Smart Contract (Si usas wDOGE)**
```bash
# Compilar contrato (requiere Truffle)
npm install -g truffle
truffle compile

# Deploy
npm run deploy:contract
```

### **Paso 6: Verificar servicios**
```bash
npm run verify
```

### **Paso 7: Iniciar servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm run deploy:prod
```

---

¿Quieres que ahora continúe con **la integración del frontend** con este backend? 🚀


