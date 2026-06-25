// 英雄数据（每个稀有度8个英雄，作为点数1-8）
const heroes = {
    1: [
        { name: '妮塔', emoji: '🐻' },
        { name: '柯尔特', emoji: '🔫' },
        { name: '公牛', emoji: '🐂' },
        { name: '布洛克', emoji: '🚀' },
        { name: '艾尔·普里莫', emoji: '🦸' },
        { name: '巴利', emoji: '🍺' },
        { name: '波克', emoji: '🎸' },
        { name: '罗莎', emoji: '🌿' }
    ],
    2: [
        { name: '杰西', emoji: '🔧' },
        { name: '爆破麦克', emoji: '💣' },
        { name: '迪克', emoji: '💥' },
        { name: '瑞科', emoji: '🤖' },
        { name: '达里尔', emoji: '🛢️' },
        { name: '潘妮', emoji: '🏴‍☠️' },
        { name: '雅琪', emoji: '⛏️' },
        { name: '格斯', emoji: '👻' }
    ],
    3: [
        { name: '阿渤', emoji: '🏹' },
        { name: '艾魅', emoji: '💄' },
        { name: '佩佩', emoji: '🎯' },
        { name: '帕姆', emoji: '💉' },
        { name: '弗兰肯', emoji: '🔨' },
        { name: '比比', emoji: '⚾' },
        { name: '贝亚', emoji: '🐝' },
        { name: '艾德加', emoji: '🦇' }
    ],
    4: [
        { name: '莫提斯', emoji: '🦇' },
        { name: '塔拉', emoji: '🔮' },
        { name: '麦克斯', emoji: '⚡' },
        { name: 'P先生', emoji: '🐧' },
        { name: '芽芽', emoji: '🌱' },
        { name: '拜伦', emoji: '💊' },
        { name: '史魁克', emoji: '💧' },
        { name: '小罗', emoji: '🤖' }
    ],
    5: [
        { name: '斯派克', emoji: '🌵' },
        { name: '黑鸦', emoji: '🦅' },
        { name: '里昂', emoji: '🦁' },
        { name: '沙迪', emoji: '😴' },
        { name: '琥珀', emoji: '🔥' },
        { name: '梅格', emoji: '🤖' },
        { name: '瑟奇', emoji: '⚡' },
        { name: '切斯特', emoji: '🎪' }
    ]
};

const rarityNames = {
    1: '稀有',
    2: '超稀有',
    3: '史诗',
    4: '神话',
    5: '传奇'
};

// 游戏状态
let stock = [];
let waste = [];
let tableau = [[], [], [], [], [], [], []];
let foundation = [[], [], [], [], []];

let selectedCards = [];
let selectedSource = null;
let selectedColumn = null;

let score = 0;
let moves = 0;
let bestScore = localStorage.getItem('taraBestScore') || 0;
let moveHistory = [];
let gameWon = false;
let stockResets = 0;

// DOM元素
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const bestScoreEl = document.getElementById('bestScore');
const foundationArea = document.getElementById('foundationArea');
const tableauArea = document.getElementById('tableauArea');
const stockPileEl = document.getElementById('stockPile');
const wastePileEl = document.getElementById('wastePile');
const gameStatusEl = document.getElementById('gameStatus');
const victoryOverlay = document.getElementById('victoryOverlay');
const victorySubtitle = document.getElementById('victorySubtitle');

bestScoreEl.textContent = bestScore;

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('全屏请求失败:', err);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function createDeck() {
    const deck = [];
    for (let rarity = 1; rarity <= 5; rarity++) {
        heroes[rarity].forEach((hero, index) => {
            deck.push({
                rarity: rarity,
                rank: index + 1,
                name: hero.name,
                emoji: hero.emoji,
                id: `${rarity}-${index}-${hero.name}`,
                facedown: true
            });
        });
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function initGame() {
    const deck = createDeck();
    
    stock = [];
    waste = [];
    tableau = [[], [], [], [], [], [], []];
    foundation = [[], [], [], [], []];
    selectedCards = [];
    selectedSource = null;
    selectedColumn = null;
    score = 0;
    moves = 0;
    moveHistory = [];
    gameWon = false;
    stockResets = 0;
    
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    gameStatusEl.classList.remove('show');
    victoryOverlay.classList.remove('show');
    
    let cardIndex = 0;
    for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
            const card = deck[cardIndex];
            card.facedown = row < col;
            tableau[col].push(card);
            cardIndex++;
        }
    }
    
    stock = deck.slice(cardIndex);
    renderAll();
}

function renderAll() {
    renderStock();
    renderWaste();
    renderFoundation();
    renderTableau();
}

function renderStock() {
    if (stock.length === 0) {
        stockPileEl.classList.add('empty');
        stockPileEl.querySelector('.pile-label').textContent = '重洗';
    } else {
        stockPileEl.classList.remove('empty');
        stockPileEl.querySelector('.pile-label').textContent = `牌库(${stock.length})`;
    }
}

function renderWaste() {
    wastePileEl.innerHTML = '<div class="pile-label">弃牌</div>';
    
    if (waste.length > 0) {
        const topCard = waste[waste.length - 1];
        const cardEl = createCardElement(topCard, 0);
        cardEl.style.position = 'absolute';
        cardEl.style.top = '0';
        cardEl.style.left = '0';
        wastePileEl.appendChild(cardEl);
        wastePileEl.querySelector('.pile-label').style.display = 'none';
        
        if (selectedSource === 'waste') {
            cardEl.classList.add('selected');
        }
    } else {
        wastePileEl.querySelector('.pile-label').style.display = 'block';
    }
}

function renderFoundation() {
    foundationArea.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        const pile = document.createElement('div');
        pile.className = `foundation-pile rarity-${i + 1}`;
        pile.dataset.rarity = i + 1;
        pile.innerHTML = `<span style="font-size: clamp(10px, 2vw, 12px);">${rarityNames[i + 1].charAt(0)}</span>`;
        
        pile.addEventListener('click', (e) => {
            e.stopPropagation();
            handleFoundationClick(i);
        });
        
        if (foundation[i].length > 0) {
            const topCard = foundation[i][foundation[i].length - 1];
            const cardEl = createCardElement(topCard, 0);
            pile.appendChild(cardEl);
            
            if (selectedSource === 'foundation' && selectedColumn === i) {
                cardEl.classList.add('selected');
            }
        }
        
        foundationArea.appendChild(pile);
    }
}

function renderTableau() {
    tableauArea.innerHTML = '';
    
    for (let col = 0; col < 7; col++) {
        const column = document.createElement('div');
        column.className = 'tableau-column';
        column.dataset.column = col;
        
        column.addEventListener('click', (e) => {
            e.stopPropagation();
            handleTableauClick(col, e);
        });
        
        tableau[col].forEach((card, index) => {
            const cardEl = createCardElement(card, index);
            cardEl.style.top = (index * 22) + 'px';
            
            if (selectedSource === 'tableau' && selectedColumn === col) {
                const selectedStartIndex = tableau[col].length - selectedCards.length;
                if (index >= selectedStartIndex) {
                    cardEl.classList.add('selected');
                }
            }
            
            column.appendChild(cardEl);
        });
        
        tableauArea.appendChild(column);
    }
}

function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = `card rarity-${card.rarity}`;
    if (card.facedown) {
        cardEl.classList.add('facedown');
    }
    
    cardEl.innerHTML = `
        <div class="card-number">${card.rank}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-rarity">${rarityNames[card.rarity]}</div>
    `;
    
    cardEl.dataset.cardId = card.id;
    return cardEl;
}

function drawFromStock() {
    if (gameWon) return;
    
    if (stock.length > 0) {
        const card = stock.pop();
        card.facedown = false;
        waste.push(card);
        
        moveHistory.push({
            type: 'draw',
            card: {...card}
        });
        
        moves++;
        movesEl.textContent = moves;
        
        clearSelection();
        renderStock();
        renderWaste();
    } else {
        if (waste.length > 0) {
            moveHistory.push({
                type: 'resetStock',
                wasteCount: waste.length
            });
            
            while (waste.length > 0) {
                const card = waste.pop();
                card.facedown = true;
                stock.push(card);
            }
            
            stockResets++;
            score = Math.max(0, score - 10);
            scoreEl.textContent = score;
            
            clearSelection();
            renderAll();
        }
    }
}

function handleWasteClick() {
    if (gameWon) return;
    if (waste.length === 0) return;
    
    const topCard = waste[waste.length - 1];
    
    if (selectedCards.length > 0) {
        clearSelection();
        renderAll();
        return;
    }
    
    selectedCards = [topCard];
    selectedSource = 'waste';
    selectedColumn = null;
    
    renderWaste();
    renderTableau();
    renderFoundation();
}

function handleTableauClick(col, event) {
    if (gameWon) return;
    
    const column = tableau[col];
    
    if (column.length === 0) {
        if (selectedCards.length > 0) {
            if (canMoveToEmptyColumn(selectedCards[0])) {
                moveCardsToTableau(col);
            } else {
                clearSelection();
                renderAll();
            }
        }
        return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const cardOffset = 22;
    let clickedIndex = Math.floor(clickY / cardOffset);
    clickedIndex = Math.min(clickedIndex, column.length - 1);
    clickedIndex = Math.max(0, clickedIndex);
    
    const clickedCard = column[clickedIndex];
    
    if (clickedCard.facedown) {
        clearSelection();
        renderAll();
        return;
    }
    
    if (selectedCards.length > 0) {
        if (canMoveToTableau(selectedCards[0], col)) {
            moveCardsToTableau(col);
        } else {
            selectCardsFromTableau(col, clickedIndex);
        }
    } else {
        selectCardsFromTableau(col, clickedIndex);
    }
}

function selectCardsFromTableau(col, startIndex) {
    const column = tableau[col];
    selectedCards = [];
    
    for (let i = startIndex; i < column.length; i++) {
        if (column[i].facedown) break;
        selectedCards.push(column[i]);
    }
    
    if (selectedCards.length > 0) {
        selectedSource = 'tableau';
        selectedColumn = col;
    } else {
        clearSelection();
    }
    
    renderAll();
}

function handleFoundationClick(rarityIndex) {
    if (gameWon) return;
    
    const pile = foundation[rarityIndex];
    
    if (selectedCards.length > 0) {
        if (selectedCards.length === 1 && canMoveToFoundation(selectedCards[0], rarityIndex)) {
            moveCardToFoundation(rarityIndex);
        } else {
            clearSelection();
            renderAll();
        }
    } else {
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            selectedCards = [topCard];
            selectedSource = 'foundation';
            selectedColumn = rarityIndex;
            renderAll();
        }
    }
}

function clearSelection() {
    selectedCards = [];
    selectedSource = null;
    selectedColumn = null;
}

function canMoveToEmptyColumn(card) {
    // 只有点数为8的牌可以放到空列
    return card.rank === 8;
}

function canMoveToTableau(card, col) {
    const column = tableau[col];
    
    if (column.length === 0) {
        return canMoveToEmptyColumn(card);
    }
    
    const topCard = column[column.length - 1];
    if (topCard.facedown) return false;
    
    return card.rank === topCard.rank - 1 && card.rarity !== topCard.rarity;
}

function canMoveToFoundation(card, rarityIndex) {
    if (card.rarity !== rarityIndex + 1) return false;
    
    const pile = foundation[rarityIndex];
    
    if (pile.length === 0) {
        return card.rank === 1;
    }
    
    const topCard = pile[pile.length - 1];
    return card.rank === topCard.rank + 1;
}

function moveCardsToTableau(targetCol) {
    if (selectedCards.length === 0) return;
    
    const historyEntry = {
        type: 'moveToTableau',
        cards: selectedCards.map(c => ({...c})),
        fromSource: selectedSource,
        fromColumn: selectedColumn,
        toColumn: targetCol,
        flippedCard: false
    };
    
    if (selectedSource === 'tableau') {
        const fromCol = selectedColumn;
        const removeCount = selectedCards.length;
        tableau[fromCol].splice(tableau[fromCol].length - removeCount, removeCount);
        
        if (tableau[fromCol].length > 0) {
            const newTop = tableau[fromCol][tableau[fromCol].length - 1];
            if (newTop.facedown) {
                newTop.facedown = false;
                historyEntry.flippedCard = true;
            }
        }
    } else if (selectedSource === 'waste') {
        waste.pop();
    } else if (selectedSource === 'foundation') {
        foundation[selectedColumn].pop();
        score -= 15;
        scoreEl.textContent = score;
    }
    
    selectedCards.forEach(card => {
        tableau[targetCol].push(card);
    });
    
    moveHistory.push(historyEntry);
    
    moves++;
    movesEl.textContent = moves;
    
    if (selectedSource === 'waste') {
        score += 5;
        scoreEl.textContent = score;
    }
    
    clearSelection();
    autoMoveToFoundation();
    renderAll();
    checkWin();
}

function moveCardToFoundation(rarityIndex) {
    if (selectedCards.length !== 1) return;
    
    const card = selectedCards[0];
    
    const historyEntry = {
        type: 'moveToFoundation',
        card: {...card},
        fromSource: selectedSource,
        fromColumn: selectedColumn,
        toColumn: rarityIndex,
        flippedCard: false
    };
    
    if (selectedSource === 'tableau') {
        tableau[selectedColumn].pop();
        
        if (tableau[selectedColumn].length > 0) {
            const newTop = tableau[selectedColumn][tableau[selectedColumn].length - 1];
            if (newTop.facedown) {
                newTop.facedown = false;
                historyEntry.flippedCard = true;
            }
        }
    } else if (selectedSource === 'waste') {
        waste.pop();
    } else if (selectedSource === 'foundation') {
        foundation[selectedColumn].pop();
    }
    
    foundation[rarityIndex].push(card);
    
    moveHistory.push(historyEntry);
    
    score += 10;
    moves++;
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    
    clearSelection();
    autoMoveToFoundation();
    renderAll();
    checkWin();
}

function autoMoveToFoundation() {
    let moved = true;
    while (moved) {
        moved = false;
        
        for (let col = 0; col < 7; col++) {
            const column = tableau[col];
            if (column.length === 0) continue;
            
            const topCard = column[column.length - 1];
            if (topCard.facedown) continue;
            
            const rarityIndex = topCard.rarity - 1;
            if (canMoveToFoundation(topCard, rarityIndex)) {
                const card = column.pop();
                foundation[rarityIndex].push(card);
                score += 10;
                scoreEl.textContent = score;
                
                if (column.length > 0) {
                    column[column.length - 1].facedown = false;
                }
                
                moved = true;
            }
        }
        
        if (waste.length > 0) {
            const topCard = waste[waste.length - 1];
            const rarityIndex = topCard.rarity - 1;
            if (canMoveToFoundation(topCard, rarityIndex)) {
                const card = waste.pop();
                foundation[rarityIndex].push(card);
                score += 10;
                scoreEl.textContent = score;
                moved = true;
            }
        }
    }
}

function undoMove() {
    if (moveHistory.length === 0 || gameWon) return;
    
    const lastMove = moveHistory.pop();
    
    if (lastMove.type === 'draw') {
        if (waste.length > 0) {
            const card = waste.pop();
            card.facedown = true;
            stock.push(card);
            moves--;
        }
    } else if (lastMove.type === 'resetStock') {
        for (let i = 0; i < lastMove.wasteCount && stock.length > 0; i++) {
            const card = stock.pop();
            card.facedown = false;
            waste.push(card);
        }
        score += 10;
        stockResets--;
    } else if (lastMove.type === 'moveToTableau') {
        const removeCount = lastMove.cards.length;
        tableau[lastMove.toColumn].splice(tableau[lastMove.toColumn].length - removeCount, removeCount);
        
        if (lastMove.fromSource === 'tableau') {
            lastMove.cards.forEach(card => {
                tableau[lastMove.fromColumn].push(card);
            });
            
            if (lastMove.flippedCard && tableau[lastMove.fromColumn].length > removeCount) {
                const idx = tableau[lastMove.fromColumn].length - removeCount - 1;
                if (idx >= 0) {
                    tableau[lastMove.fromColumn][idx].facedown = true;
                }
            }
        } else if (lastMove.fromSource === 'waste') {
            waste.push(lastMove.cards[0]);
            score -= 5;
        } else if (lastMove.fromSource === 'foundation') {
            foundation[lastMove.fromColumn].push(lastMove.cards[0]);
            score += 15;
        }
        
        moves--;
    } else if (lastMove.type === 'moveToFoundation') {
        foundation[lastMove.toColumn].pop();
        
        if (lastMove.fromSource === 'tableau') {
            tableau[lastMove.fromColumn].push(lastMove.card);
            
            if (lastMove.flippedCard && tableau[lastMove.fromColumn].length > 1) {
                tableau[lastMove.fromColumn][tableau[lastMove.fromColumn].length - 2].facedown = true;
            }
        } else if (lastMove.fromSource === 'waste') {
            waste.push(lastMove.card);
        } else if (lastMove.fromSource === 'foundation') {
            foundation[lastMove.fromColumn].push(lastMove.card);
        }
        
        score -= 10;
        moves--;
    }
    
    scoreEl.textContent = score;
    movesEl.textContent = moves;
    
    clearSelection();
    renderAll();
}

function checkWin() {
    let totalFoundation = 0;
    foundation.forEach(pile => {
        totalFoundation += pile.length;
    });
    
    if (totalFoundation === 40) {
        gameWon = true;
        
        const moveBonus = Math.max(0, (100 - moves) * 2);
        const resetPenalty = stockResets * 20;
        const bonus = Math.max(0, moveBonus - resetPenalty);
        
        score += bonus;
        scoreEl.textContent = score;
        
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('taraBestScore', bestScore);
            bestScoreEl.textContent = bestScore;
        }
        
        victorySubtitle.textContent = `总得分：${score} 分`;
        submitScore(score);
        
        setTimeout(() => {
            triggerVictoryAnimation();
        }, 500);
    }
}

function triggerVictoryAnimation() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            const flyingCard = card.cloneNode(true);
            flyingCard.classList.add('flying-card');
            flyingCard.style.left = card.getBoundingClientRect().left + 'px';
            flyingCard.style.top = card.getBoundingClientRect().top + 'px';
            document.body.appendChild(flyingCard);
            
            setTimeout(() => {
                flyingCard.style.left = (Math.random() * window.innerWidth) + 'px';
                flyingCard.style.top = (Math.random() * window.innerHeight) + 'px';
                flyingCard.style.transform = `rotate(${Math.random() * 720 - 360}deg) scale(0.5)`;
                flyingCard.style.opacity = '0';
            }, 50);
            
            setTimeout(() => {
                flyingCard.remove();
            }, 1050);
        }, index * 30);
    });
    
    setTimeout(() => {
        victoryOverlay.classList.add('show');
    }, cards.length * 30 + 500);
}

function resetGame() {
    victoryOverlay.classList.remove('show');
    initGame();
}

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.card') && 
        !e.target.closest('.tableau-column') && 
        !e.target.closest('.foundation-pile') &&
        !e.target.closest('.waste-pile') &&
        !e.target.closest('.stock-pile')) {
        if (selectedCards.length > 0) {
            clearSelection();
            renderAll();
        }
    }
});

initGame();

function showLeaderboard() {
    document.getElementById('leaderboardModal').classList.remove('hidden');
    loadLeaderboard();
}

function closeLeaderboard() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}

async function loadLeaderboard() {
    const listContainer = document.getElementById('leaderboardList');
    listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">加载中...</div>';
    
    try {
        const response = await fetch('/api/leaderboard/tara-cards');
        const data = await response.json();
        
        if (data.success && data.leaderboard.length > 0) {
            listContainer.innerHTML = data.leaderboard.map((item, index) => `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${index < 3 ? 'rank-' + (index + 1) : 'rank-other'}">
                        ${index + 1}
                    </div>
                    <div class="leaderboard-name">${escapeHtml(item.nickname)}</div>
                    <div class="leaderboard-score">
                        ${item.score}
                        <span class="leaderboard-unit">${data.config.unit}</span>
                    </div>
                </div>
            `).join('');
        } else {
            listContainer.innerHTML = `
                <div class="leaderboard-empty">
                    <div class="leaderboard-empty-icon">🎯</div>
                    <p>暂无排行记录</p>
                    <p style="font-size:12px;margin-top:5px;">快去挑战成为第一名吧！</p>
                </div>
            `;
        }
    } catch (error) {
        listContainer.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">❌</div>
                <p>加载失败</p>
                <p style="font-size:12px;margin-top:5px;">请确保服务器已启动</p>
            </div>
        `;
    }
}

async function submitScore(score) {
    const nickname = localStorage.getItem('gameNickname');
    if (!nickname) return;
    
    try {
        await fetch('/api/leaderboard/tara-cards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: nickname,
                score: score,
                extra: {
                    moves: moves
                }
            })
        });
    } catch (error) {
        console.log('提交成绩失败:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('leaderboardModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeLeaderboard();
    }
});