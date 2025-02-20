// Define bonus types as constants
const BonusType = {
    PRODUCTION: 'PRODUCTION',
    DEFENSE: 'DEFENSE',
    ATTACK: 'ATTACK',
    MOVEMENT: 'MOVEMENT',
    MYSTERY: 'MYSTERY'  // Add Mystery type
};

// Define game constants
const TROOP_PRODUCTION_CAP = 50;
const MYSTERY_SQUARE_COUNT = 10;  // Number of mystery squares to place
const SURGICAL_STRIKE_DAMAGE = 100;  // Damage to surrounding squares

class GridStateGame {
    constructor(size, numPlayers) {
        this.gridSize = 20;
        this.grid = this.initializeGrid();
        this.players = this.initializePlayers(numPlayers);
        this.currentPlayer = 0;
        this.selectedCell = null;
        this.gameOver = false;
        this.surgicalStrikeAvailable = false;
        this.surgicalStrikeMode = false;
        
        // Initialize canvas and context first
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Create surgical strike button
        this.createSurgicalStrikeButton();
        
        // Then update the canvas size
        this.updateCanvasSize();
        
        // Add click handler
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    createSurgicalStrikeButton() {
        this.surgicalStrikeButton = document.createElement('button');
        this.surgicalStrikeButton.className = 'surgical-strike-button';
        this.surgicalStrikeButton.textContent = 'Surgical Strike';
        this.surgicalStrikeButton.style.display = 'none';
        this.surgicalStrikeButton.addEventListener('click', () => this.activateSurgicalStrike());
    }

    activateSurgicalStrike() {
        if (this.surgicalStrikeAvailable) {
            this.surgicalStrikeMode = true;
            this.surgicalStrikeButton.style.backgroundColor = '#ff0000';
        }
    }
    
    updateCanvasSize() {
        // Calculate 90% of viewport height
        const vh = Math.min(window.innerHeight, window.innerWidth);
        const size = Math.floor(vh * 0.9);
        
        // Update canvas size
        this.canvas.width = size;
        this.canvas.height = size;
        
        // Re-render if grid exists and context exists
        if (this.grid && this.ctx) {
            this.render();
        }
    }

    getDarkerColor(color) {
        // Convert hex to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Darken by 40%
        const darkenFactor = 0.6;
        const darkR = Math.floor(r * darkenFactor);
        const darkG = Math.floor(g * darkenFactor);
        const darkB = Math.floor(b * darkenFactor);
        
        // Convert back to hex
        return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
    }

    initializeGrid() {
        const grid = [];
        for (let y = 0; y < this.gridSize; y++) {
            grid[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                grid[y][x] = {
                    owner: null,
                    troops: 0,
                    bonus: null
                };
            }
        }

        // Place mystery squares randomly
        let mysterySquaresPlaced = 0;
        while (mysterySquaresPlaced < MYSTERY_SQUARE_COUNT) {
            const x = Math.floor(Math.random() * this.gridSize);
            const y = Math.floor(Math.random() * this.gridSize);
            if (grid[y][x].bonus === null) {
                grid[y][x].bonus = BonusType.MYSTERY;
                mysterySquaresPlaced++;
            }
        }

        // Place other bonuses
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (grid[y][x].bonus === null && Math.random() < 0.2) {
                    const bonuses = Object.values(BonusType).filter(b => b !== BonusType.MYSTERY);
                    grid[y][x].bonus = bonuses[Math.floor(Math.random() * bonuses.length)];
                }
            }
        }

        return grid;
    }
    
    initializePlayers(numPlayers) {
        const players = [];
        const colors = [
            '#ff4444', // Bright red
            '#44ff44', // Bright green
            '#4444ff', // Bright blue
            '#ffff44'  // Bright yellow
        ];
        
        for (let i = 0; i < numPlayers; i++) {
            players.push({
                id: i,
                color: colors[i],
                isAI: i > 0
            });
            
            const pos = this.getStartingPosition(i, numPlayers);
            this.grid[pos.y][pos.x].owner = i;
            this.grid[pos.y][pos.x].troops = 1;
        }
        
        return players;
    }
    
    getStartingPosition(playerIndex, totalPlayers) {
        const angle = (2 * Math.PI * playerIndex) / totalPlayers;
        const radius = this.gridSize / 3;
        const centerX = this.gridSize / 2;
        const centerY = this.gridSize / 2;
        
        return {
            x: Math.floor(centerX + radius * Math.cos(angle)),
            y: Math.floor(centerY + radius * Math.sin(angle))
        };
    }
    
    handleClick(event) {
        if (this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = Math.floor(((event.clientX - rect.left) * scaleX) / (this.canvas.width / this.gridSize));
        const y = Math.floor(((event.clientY - rect.top) * scaleY) / (this.canvas.height / this.gridSize));
        
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;

        if (this.surgicalStrikeMode) {
            this.performSurgicalStrike(x, y);
            return;
        }
        
        if (!this.selectedCell) {
            // Select cell if it belongs to current player
            if (this.grid[y][x].owner === this.currentPlayer) {
                this.selectedCell = { x, y };
                this.render(); // Highlight selected cell
            }
        } else {
            // Try to move troops if move is valid
            if (this.isValidMove(this.selectedCell, { x, y })) {
                this.moveTroops(this.selectedCell, { x, y });
                this.endTurn();
            }
            this.selectedCell = null;
            this.render();
        }
    }
    
    isValidMove(from, to) {
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        
        // Check if source cell belongs to current player
        if (this.grid[from.y][from.x].owner !== this.currentPlayer) {
            return false;
        }
        
        // Check movement range (1 square normally, 2 if MOVEMENT bonus)
        const maxDistance = this.grid[from.y][from.x].bonus === BonusType.MOVEMENT ? 2 : 1;
        return dx <= maxDistance && dy <= maxDistance;
    }
    
    moveTroops(from, to) {
        const sourceCell = this.grid[from.y][from.x];
        const targetCell = this.grid[to.y][to.x];
        
        // Check if target is a mystery square
        if (targetCell.bonus === BonusType.MYSTERY && targetCell.owner !== sourceCell.owner) {
            // Activate surgical strike
            this.surgicalStrikeAvailable = true;
            this.surgicalStrikeButton.style.display = 'block';
            // Remove the mystery bonus after discovery
            targetCell.bonus = null;
        }

        // Keep 1 troop behind, rest attack
        const movingTroops = sourceCell.troops - 1;
        
        // Only proceed if we have more than 1 troop (so we can leave 1 behind)
        if (movingTroops < 1) {
            return; // Can't attack with just 1 troop
        }
        
        sourceCell.troops = 1; // Leave exactly 1 troop behind
        
        if (targetCell.owner === sourceCell.owner) {
            // Reinforcement - no cap when merging friendly troops
            targetCell.troops += movingTroops;
        } else {
            // Attack
            const attackStrength = movingTroops * 
                (sourceCell.bonus === BonusType.ATTACK ? 1.5 : 1);
            const defenseStrength = targetCell.troops *
                (targetCell.bonus === BonusType.DEFENSE ? 1.5 : 1);
            
            if (attackStrength > defenseStrength) {
                targetCell.owner = sourceCell.owner;
                targetCell.troops = Math.floor(attackStrength - defenseStrength);
            } else {
                targetCell.troops = Math.floor(defenseStrength - attackStrength);
            }
        }
    }

    performSurgicalStrike(centerX, centerY) {
        // Perform the strike on 3x3 area
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = centerX + dx;
                const y = centerY + dy;
                if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
                    const cell = this.grid[y][x];
                    if (dx === 0 && dy === 0) {
                        // Center square is completely cleared
                        cell.troops = 0;
                        cell.owner = null;
                    } else if (cell.troops > 0) {
                        // Surrounding squares lose troops
                        cell.troops = Math.max(0, cell.troops - SURGICAL_STRIKE_DAMAGE);
                        if (cell.troops === 0) {
                            cell.owner = null;
                        }
                    }
                }
            }
        }

        // Reset surgical strike state
        this.surgicalStrikeMode = false;
        this.surgicalStrikeAvailable = false;
        this.surgicalStrikeButton.style.display = 'none';
        this.surgicalStrikeButton.style.backgroundColor = '';
        this.endTurn();
    }
    
    endTurn() {
        // Check for win condition before proceeding with the turn
        if (this.checkWinCondition()) {
            return; // Stop the turn if game is over
        }

        // Produce new troops with cap
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                if (cell.owner !== null) {
                    const productionRate = cell.bonus === BonusType.PRODUCTION ? 2 : 1;
                    // Only add troops if below cap
                    if (cell.troops < TROOP_PRODUCTION_CAP) {
                        cell.troops = Math.min(TROOP_PRODUCTION_CAP, cell.troops + productionRate);
                    }
                }
            }
        }
        
        // Next player
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        
        // If next player is AI, perform AI turn
        if (this.players[this.currentPlayer].isAI) {
            this.performAITurn();
        }
    }

    checkWinCondition() {
        // Get all unique army owners present on the grid
        const remainingArmies = new Set();
        
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                if (cell.owner !== null) {
                    remainingArmies.add(cell.owner);
                }
            }
        }

        // If only one army remains, we have a winner
        if (remainingArmies.size === 1) {
            const winnerId = Array.from(remainingArmies)[0];
            this.gameOver = true;
            this.announceWinner(winnerId);
            return true;
        }

        return false;
    }

    announceWinner(winnerId) {
        // Create winner announcement overlay
        const overlay = document.createElement('div');
        overlay.className = 'winner-overlay';
        
        const message = document.createElement('div');
        message.className = 'winner-message';
        
        const winnerColor = this.players[winnerId].color;
        const isPlayer = !this.players[winnerId].isAI;
        
        message.innerHTML = `
            <h2>Game Over!</h2>
            <p>${isPlayer ? 'You have' : 'AI Player ' + winnerId + ' has'} won the game!</p>
            <button onclick="startGame(${this.players.length - 1})">Play Again</button>
        `;
        
        // Add a colored border matching the winner's color
        message.style.borderColor = winnerColor;
        
        overlay.appendChild(message);
        this.canvas.parentElement.appendChild(overlay);
    }
    
    performAITurn() {
        if (this.gameOver) return; // Don't perform AI turn if game is over
        
        // Simple AI: Find strongest cell and attack/reinforce neighbors
        let strongestCell = null;
        let maxTroops = 0;
        
        // Find strongest cell
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                if (cell.owner === this.currentPlayer && cell.troops > maxTroops) {
                    strongestCell = { x, y };
                    maxTroops = cell.troops;
                }
            }
        }
        
        if (strongestCell) {
            // Find valid targets
            const targets = this.getValidMoveTargets(strongestCell);
            if (targets.length > 0) {
                // Choose random target
                const target = targets[Math.floor(Math.random() * targets.length)];
                this.moveTroops(strongestCell, target);
            }
        }
        
        // Use surgical strike if available (AI)
        if (this.surgicalStrikeAvailable) {
            this.surgicalStrikeMode = true;
            // Find the highest value target for the strike
            let bestTarget = null;
            let maxValue = 0;
            
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (this.grid[y][x].owner !== this.currentPlayer) {
                        let totalValue = 0;
                        // Calculate value of 3x3 area
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                                    const cell = this.grid[ny][nx];
                                    if (cell.owner !== this.currentPlayer) {
                                        totalValue += cell.troops;
                                    }
                                }
                            }
                        }
                        if (totalValue > maxValue) {
                            maxValue = totalValue;
                            bestTarget = { x, y };
                        }
                    }
                }
            }
            
            if (bestTarget) {
                this.performSurgicalStrike(bestTarget.x, bestTarget.y);
            }
        }
        
        this.endTurn();
    }
    
    getValidMoveTargets(pos) {
        const targets = [];
        const maxDistance = this.grid[pos.y][pos.x].bonus === BonusType.MOVEMENT ? 2 : 1;
        
        for (let dy = -maxDistance; dy <= maxDistance; dy++) {
            for (let dx = -maxDistance; dx <= maxDistance; dx++) {
                const x = pos.x + dx;
                const y = pos.y + dy;
                if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
                    if (dx !== 0 || dy !== 0) { // Exclude the source cell
                        targets.push({ x, y });
                    }
                }
            }
        }
        
        return targets;
    }
    
    render() {
        const cellSize = this.canvas.width / this.gridSize;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Background color
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate font sizes based on cell size
        const bonusFontSize = Math.max(10, Math.floor(cellSize * 0.5));
        const troopFontSize = Math.max(12, Math.floor(cellSize * 0.6));
        
        // Draw grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                
                // Draw cell background (darker colors)
                if (cell.owner !== null) {
                    this.ctx.fillStyle = this.getDarkerColor(this.players[cell.owner].color);
                } else {
                    this.ctx.fillStyle = '#2d2d2d'; // Dark grey for empty cells
                }
                this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                
                // Draw bonus indicator with Teko font - Hide Mystery squares
                if (cell.bonus && cell.bonus !== BonusType.MYSTERY) {
                    this.ctx.fillStyle = '#ffffff'; // White text
                    this.ctx.font = `${bonusFontSize}px Teko`;
                    const bonusSymbol = cell.bonus[0];  // First letter for non-Mystery bonuses
                    this.ctx.fillText(bonusSymbol, 
                        x * cellSize + (cellSize * 0.1), 
                        y * cellSize + (cellSize * 0.4));
                }
                
                // Draw troop count with Teko font
                if (cell.troops > 0) {
                    this.ctx.fillStyle = '#ffffff'; // White text
                    this.ctx.font = `${troopFontSize}px Teko`;
                    const text = cell.troops.toString();
                    const textMetrics = this.ctx.measureText(text);
                    this.ctx.fillText(text, 
                        x * cellSize + (cellSize * 0.5) - (textMetrics.width * 0.5), 
                        y * cellSize + (cellSize * 0.6));
                }
                
                // Draw grid lines in lighter color
                this.ctx.strokeStyle = '#3d3d3d';
                this.ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
        
        // Highlight selected cell
        if (this.selectedCell) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = Math.max(2, cellSize * 0.1);
            this.ctx.strokeRect(
                this.selectedCell.x * cellSize,
                this.selectedCell.y * cellSize,
                cellSize,
                cellSize
            );
            this.ctx.lineWidth = 1;
        }
    }
    
    mount(container) {
        container.appendChild(this.canvas);
        container.appendChild(this.surgicalStrikeButton);
        this.render();
    }
}
