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
        require(tokenAddress != address(this), "No se puede
