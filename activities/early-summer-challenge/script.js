/**
 * 初夏挑战季活动 - 前端逻辑
 * ============================
 * 架构说明：
 *   - 配置从服务端 /api/activity/early-summer-challenge 加载，失败时使用内置默认配置
 *   - 用户数据采用 localStorage + 服务端双重存储：
 *     * 积分数据（challengePoints/predictionPoints/totalPoints）从服务端加载
 *     * 挑战记录/预测/分享状态存储在 localStorage
 *   - 三个功能模块：游戏挑战(challenge)、赛事预测(prediction)、宝石抽奖(lottery)
 *   - 排行榜复用大厅 API：GET /api/leaderboard/:gameId
 * 
 * 依赖：
 *   - 需要用户在大厅已设置昵称（localStorage.gameNickname）
 *   - 依赖服务端 Express + Socket.io 提供的 API
 */

// ==================== 全局变量 ====================

/** @type {Object|null} 活动配置对象，从服务端加载或使用默认值 */
let activityConfig = null;

/** @type {string} 当前用户昵称，从 localStorage 读取 */
let userNickname = localStorage.getItem('gameNickname') || '';

/**
 * @typedef {Object} UserData
 * @property {number} challengePoints - 挑战积分
 * @property {number} predictionPoints - 预测积分
 * @property {number} totalPoints - 总积分
 * @property {Object} challenges - 每个游戏的挑战记录 { gameId: { rounds, bestScore, completed, resetsUsed } }
 * @property {Object} predictions - 预测记录 { matchId: winnerTeamId, ... }
 * @property {boolean} predictionLocked - 预测是否已锁定（提交后锁定，需点更改才能编辑）
 * @property {boolean} shared - 是否已分享
 * @property {boolean} lotteryUnlocked - 抽奖是否解锁
 * @property {number} lotteryCount - 抽奖次数
 * @property {string|null} challengeCode - 挑战码（首次抽奖后生成）
 */
let userData = {
    challengePoints: 0,
    predictionPoints: 0,
    totalPoints: 0,
    predictionSettled: null, // { correctCount, totalCount, pointsAwarded } 或 null
    challenges: {},
    predictions: {},
    predictionLocked: false,
    shared: false,
    lotteryUnlocked: false,
    lotteryCount: 0,
    challengeCode: null
};

// ==================== 初始化流程 ====================

/** 页面加载完成后初始化 */
document.addEventListener('DOMContentLoaded', function() {
    init();
});

/**
 * 初始化活动页面
 * 检查昵称 → 加载活动配置 → 加载用户数据 → 渲染UI → 启动倒计时
 * @async
 */
async function init() {
    if (!userNickname) {
        showToast('请先在大厅设置昵称');
        setTimeout(() => {
            window.location.href = '/activity.html';
        }, 1500);
        return;
    }

    await loadActivityConfig();
    await loadUserData();
    initUI();
    startCountdowns();
    // 检查是否有进行中的挑战 Session
    await checkActiveChallengeSession();
}

// ==================== 数据加载 ====================

/**
 * 从服务端加载活动配置
 * 请求 GET /api/activity/early-summer-challenge
 * 失败时使用内置默认配置兜底
 * @async
 */
async function loadActivityConfig() {
    try {
        const response = await fetch('/api/activity/early-summer-challenge');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.activity) {
                activityConfig = data.activity;
                return;
            }
        }
        // API返回非ok或数据无效，使用默认配置
        throw new Error('API returned invalid data');
    } catch (error) {
        console.error('加载活动配置失败，使用默认配置:', error.message);
        // 使用默认配置
        activityConfig = {
            id: 'early-summer-challenge',
            name: '初夏挑战季',
            description: '玩游戏赢积分，抽宝石大奖！',
            icon: '🌸',
            startTime: '2026-06-20T00:00:00',
            endTime: '2026-07-10T23:59:59',
            enabled: true,
            modules: ['challenge', 'prediction', 'lottery'],
            prediction: {
                deadline: '2026-06-27T15:00:00',
                teams: [
                    { id: 'ace-xero', name: 'ACE XERO', abbr: 'AXR', color: '#00BCD4', group: 'A', players: ['冷饮', '意境', 'GALAXY'] },
                    { id: 'toxic-lotus', name: 'TOXIC LOTUS', abbr: 'TL', color: '#2E7D32', group: 'B', players: ['小鸥', '若白', '司机'] },
                    { id: 'last-hope-fire', name: 'LAST HOPE FIRE', abbr: 'LHF', color: '#E53935', group: 'B', players: ['辰星', '唯爱大王', 'STORY'] },
                    { id: 'toc', name: 'TOC', abbr: 'TOC', color: '#795548', group: 'A', players: ['自信丢枪', '狐狸', '橡皮人的友谊'] },
                    { id: 'tig-revival', name: 'TIG REVIVAL', abbr: 'TIG', color: '#2196F3', group: 'A', players: ['灵林', '火光', '丸子头'] },
                    { id: 'smdy', name: 'SMDY', abbr: 'SMDY', color: '#FF9800', group: 'B', players: ['SODAA', 'FENGOU', 'CLEAR'] },
                    { id: 'irisout', name: 'IRIS OUT', abbr: 'IRIS', color: '#9C27B0', group: 'B', players: ['情人', '下山', 'EXPRESSION'] },
                    { id: 'dark-spirit', name: 'DARK SPIRIT', abbr: 'DS', color: '#212121', group: 'A', players: ['灰原哀', '北北', '汐风'] }
                ],
                schedule: {
                    mainStage: [
                        { group: 'A', time: '15:00', team1: 'ace-xero', team2: 'dark-spirit' },
                        { group: 'A', time: '15:50', team1: 'toc', team2: 'tig-revival' },
                        { group: 'A', time: '16:40', team1: 'dark-spirit', team2: 'tig-revival' },
                        { group: 'B', time: '17:30', team1: 'toxic-lotus', team2: 'last-hope-fire' },
                        { group: 'B', time: '18:20', team1: 'last-hope-fire', team2: 'irisout' },
                        { group: 'B', time: '19:10', team1: 'smdy', team2: 'toxic-lotus' }
                    ],
                    subStage: [
                        { group: 'B', time: '15:00', team1: 'toxic-lotus', team2: 'irisout' },
                        { group: 'B', time: '15:50', team1: 'last-hope-fire', team2: 'smdy' },
                        { group: 'B', time: '16:40', team1: 'irisout', team2: 'smdy' },
                        { group: 'A', time: '17:30', team1: 'ace-xero', team2: 'toc' },
                        { group: 'A', time: '18:20', team1: 'toc', team2: 'dark-spirit' },
                        { group: 'A', time: '19:10', team1: 'tig-revival', team2: 'ace-xero' }
                    ]
                },
                allowChange: true,
                reward: 25,
                participateReward: 5
            },
            challenge: {
                games: [
                    { id: 'belle-challenge', name: '贝尔的挑战', icon: '💣', difficulty: '简单', maxScore: 100, sort: 'asc', pageUrl: '/game/belle-challenge' },
                    { id: '8bit-arcade', name: '8比特街机', icon: '🕹️', difficulty: '简单', maxScore: 500, sort: 'desc', scoreCap: 500, pageUrl: '/game/8bit-arcade' },
                    { id: 'rosa-ember', name: '罗莎琥珀好姐妹', icon: '🌿', difficulty: '简单AI', maxScore: 100, sort: 'desc', pageUrl: '/game/rosa-ember' },
                    { id: 'buster-montage', name: '巴斯特的蒙太奇', icon: '🎬', difficulty: '简单', maxScore: 200, sort: 'desc', pageUrl: '/game/buster-montage' },
                    { id: 'tara-cards', name: '卡牌大师塔拉', icon: '🃏', difficulty: '简单', maxScore: 100, sort: 'asc', pageUrl: '/game/tara-cards' }
                ],
                rounds: 3,
                resetChance: 1,
                rewardMultiplier: 1
            },
            lottery: {
                cost: 50,
                shareBonus: 1.2,
                challengeWeight: 0.75,
                predictionWeight: 0.25,
                prizes: [
                    { name: '30宝石', probability: 0.30 },
                    { name: '50宝石', probability: 0.20 },
                    { name: '100宝石', probability: 0.15 },
                    { name: '200宝石', probability: 0.10 },
                    { name: '皮肤宝箱', probability: 0.10 },
                    { name: '限定头像框', probability: 0.08 },
                    { name: '限定皮肤', probability: 0.05 },
                    { name: '再来一次', probability: 0.02 }
                ]
            }
        };
    }
}

/**
 * 加载用户数据
 * - 积分数据从服务端 GET /api/user/:nickname/points 加载
 * - 挑战/预测/分享状态从 localStorage 加载
 * @async
 */
async function loadUserData() {
    try {
        const response = await fetch(`/api/user/${encodeURIComponent(userNickname)}/points`);
        if (response.ok) {
            const data = await response.json();
            if (data.points) {
                userData.challengePoints = data.points.challenge || 0;
                userData.predictionPoints = data.points.prediction || 0;
                userData.totalPoints = data.points.total || 0;
            }
        }
    } catch (error) {
        console.error('加载用户数据失败:', error);
    }

    // 加载预测结算状态（如果有）
    try {
        const predRes = await fetch(`/api/activity/early-summer-challenge/prediction/${encodeURIComponent(userNickname)}`);
        if (predRes.ok) {
            const predData = await predRes.json();
            if (predData.prediction && predData.prediction.settled) {
                userData.predictionSettled = {
                    correctCount: predData.prediction.correctCount || 0,
                    totalCount: predData.prediction.totalCount || 0,
                    pointsAwarded: predData.prediction.pointsAwarded || 0
                };
            }
        }
    } catch (e) {
        // 预测结算状态加载失败不影响主流程
    }
    
    // 从本地存储加载挑战记录
    const savedChallenges = localStorage.getItem(`early-summer-challenges-${userNickname}`);
    if (savedChallenges) {
        userData.challenges = JSON.parse(savedChallenges);
    }
    
    // 从本地存储加载预测记录
    const savedPredictions = localStorage.getItem(`early-summer-predictions-${userNickname}`);
    if (savedPredictions) {
        userData.predictions = JSON.parse(savedPredictions);
    }
    
    // 从本地存储加载预测锁定状态
    const savedLocked = localStorage.getItem(`early-summer-prediction-locked-${userNickname}`);
    if (savedLocked !== null) {
        userData.predictionLocked = JSON.parse(savedLocked);
    }
    
    // 从本地存储加载分享状态
    const savedShared = localStorage.getItem(`early-summer-shared-${userNickname}`);
    if (savedShared !== null) {
        userData.shared = JSON.parse(savedShared);
    }
    
    // 从本地存储加载抽奖解锁状态
    const savedUnlocked = localStorage.getItem(`early-summer-lottery-unlocked`);
    if (savedUnlocked !== null) {
        userData.lotteryUnlocked = JSON.parse(savedUnlocked);
    }
}

// ==================== 本地数据持久化 ====================

/** 保存挑战记录到 localStorage */
function saveChallengeData() {
    localStorage.setItem(`early-summer-challenges-${userNickname}`, JSON.stringify(userData.challenges));
}

/** 保存预测数据到 localStorage */
function savePredictionData() {
    localStorage.setItem(`early-summer-predictions-${userNickname}`, JSON.stringify(userData.predictions));
}

/** 保存预测锁定状态到 localStorage */
function savePredictionLocked() {
    localStorage.setItem(`early-summer-prediction-locked-${userNickname}`, JSON.stringify(userData.predictionLocked));
}

/** 保存分享状态到 localStorage */
function saveSharedData() {
    localStorage.setItem(`early-summer-shared-${userNickname}`, JSON.stringify(userData.shared));
}

// ==================== UI初始化与渲染 ====================

/** 初始化UI：积分显示 + 挑战列表 + 预测赛程 + 抽奖状态 + 加权积分 */
function initUI() {
    // 更新积分显示
    updatePointsDisplay();
    
    // 渲染游戏挑战列表
    renderChallengeGames();
    
    // 渲染预测赛程
    renderPredictionSchedule();
    
    // 更新抽奖模块状态
    updateLotteryStatus();
    
    // 更新加权积分显示
    updateWeightedPoints();
}

// ==================== 积分与展示 ====================

/** 更新页面积分数字显示 */
function updatePointsDisplay() {
    document.getElementById('challengePoints').textContent = userData.challengePoints;
    document.getElementById('predictionPoints').textContent = userData.predictionPoints;
    document.getElementById('totalPoints').textContent = userData.totalPoints;
}

/**
 * 渲染游戏挑战列表
 * 根据 activityConfig.challenge.games 和 userData.challenges 动态生成卡片
 */
let challengeGameStates = {}; // 每个游戏的挑战状态缓存
let activeSessionMap = {};     // gameId -> session

async function loadAllChallengeProgress() {
    if (!activityConfig || !activityConfig.challenge) return;
    const games = activityConfig.challenge.games;
    const nickname = userNickname;
    if (!nickname) return;

    try {
        const res = await fetch(`/api/challenge/user/${encodeURIComponent(nickname)}/best?activityId=early-summer-challenge`);
        if (res.ok) {
            const data = await res.json();
            for (const game of games) {
                const bestData = data.best[game.id];
                if (bestData) {
                    challengeGameStates[game.id] = {
                        bestScore: bestData.bestScore,
                        completed: bestData.completed,
                        error: null
                    };
                } else {
                    challengeGameStates[game.id] = {
                        bestScore: null,
                        completed: false,
                        error: null
                    };
                }
            }
        }
    } catch (e) {
        console.error('加载挑战进度失败:', e);
    }
    renderChallengeGames();
}

function renderChallengeGames() {
    const container = document.getElementById('challengeGames');
    if (!activityConfig || !activityConfig.challenge) return;
    
    const games = activityConfig.challenge.games;
    const maxRounds = activityConfig.challenge.rounds;
    
    container.innerHTML = games.map(game => {
        const state = challengeGameStates[game.id] || {};
        const bestScore = state.bestScore;
        const isCompleted = state.completed || false;

        const activeSession = activeSessionMap[game.id];
        let currentProgress = 0;
        let inProgress = false;

        if (activeSession && activeSession.status === 'active') {
            currentProgress = activeSession.scores ? activeSession.scores.length : 0;
            inProgress = true;
        }

        const challengeData = userData.challenges[game.id];
        const resetsUsed = challengeData ? challengeData.resetsUsed || 0 : 0;
        const canReset = isCompleted && !inProgress && resetsUsed < activityConfig.challenge.resetChance;

        const bestScoreText = inProgress
            ? `挑战进行中...（${currentProgress}/${maxRounds}局）`
            : (bestScore !== null && bestScore !== undefined
                ? `最佳成绩：${bestScore}${getScoreUnit(game.id)}`
                : '暂无成绩');

        const earnedPoints = bestScore !== null && bestScore !== undefined
            ? calculateChallengePoints(game.id, bestScore)
            : 0;

        const progressText = inProgress
            ? `进行中：${currentProgress}/${maxRounds} 局`
            : (isCompleted ? `已完成（${maxRounds}/${maxRounds}）` : `进度：0/${maxRounds} 局`);

        const btnText = inProgress ? '继续挑战' : '再次挑战';

        return `
            <div class="challenge-game-card ${isCompleted && !inProgress ? 'completed' : ''}" data-game-id="${game.id}">
                <div class="game-icon-large">${game.icon || '🎮'}</div>
                <div class="game-info">
                    <div class="game-name">${game.name}</div>
                    <span class="game-difficulty">${game.difficulty}</span>
                    <div class="game-progress">${progressText}</div>
                    <div class="game-best-score">${bestScoreText}</div>
                    ${earnedPoints > 0 ? `<div class="game-earned-points">已获得 ${earnedPoints} 积分</div>` : ''}
                </div>
                <div class="game-actions-challenge">
                    <button class="challenge-btn start" onclick="startChallenge('${game.id}')" ${isCompleted && !inProgress && !canReset ? 'disabled' : ''}>
                        ${btnText}
                    </button>
                    <button class="challenge-btn reset" onclick="resetChallenge('${game.id}')" ${!canReset ? 'disabled' : ''}>
                        重置挑战 (${activityConfig.challenge.resetChance - resetsUsed}次)
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 获取分数单位
 * @param {string} gameId - 游戏ID
 * @returns {string} 单位文字（秒/分/胜）
 */
function getScoreUnit(gameId) {
    const units = {
        'belle-challenge': '秒',
        '8bit-arcade': '分',
        'rosa-ember': '胜',
        'buster-montage': '分',
        'tara-cards': '秒'
    };
    return units[gameId] || '分';
}

// ==================== 游戏挑战模块 ====================

/** 当前活跃的挑战 Session ID */
let activeChallengeSession = null;

/** 当前游戏 ID（用于轮询） */
let pollingGameId = null;
let pollingInterval = null;

/**
 * 开始/继续挑战
 * 创建挑战 Session → 跳转到游戏页面
 * @param {string} gameId - 游戏ID
 */
async function startChallenge(gameId) {
    const game = activityConfig && activityConfig.challenge
        ? activityConfig.challenge.games.find(g => g.id === gameId)
        : null;
    const pageUrl = game ? game.pageUrl : '/#games';

    try {
        // 创建挑战 Session
        const response = await fetch('/api/challenge/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nickname: userNickname,
                activityId: 'early-summer-challenge',
                gameId: gameId
            })
        });

        if (response.ok) {
            const data = await response.json();
            activeChallengeSession = data.session.id;
            pollingGameId = gameId;
            activeSessionMap[gameId] = data.session;
            // 将 sessionId 和 gameId 存入 localStorage，用于游戏页获取
            localStorage.setItem('challengeSessionId', activeChallengeSession);
            localStorage.setItem('challengeGameId', gameId);
            localStorage.setItem('challengeActivityId', 'early-summer-challenge');
            // 刷新 UI 显示进度
            renderChallengeGames();
            // 启动轮询
            startPollingSession();
        } else {
            // 回退：不带 session 跳转
            localStorage.removeItem('challengeSessionId');
            localStorage.removeItem('challengeGameId');
            localStorage.removeItem('challengeActivityId');
        }
    } catch (error) {
        console.error('创建挑战Session失败:', error);
        localStorage.removeItem('challengeSessionId');
    }

    // 跳转到游戏页面
    const targetUrl = pageUrl.includes('?')
        ? `${pageUrl}&session=${activeChallengeSession || ''}`
        : `${pageUrl}?session=${activeChallengeSession || ''}`;
    showToast('开始挑战！完成后返回此页面提交成绩');
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 1000);
}

/**
 * 检查并加载进行中的挑战 Session
 * 页面加载时调用，检测是否有未完成的挑战
 */
async function checkActiveChallengeSession() {
    const sessionId = localStorage.getItem('challengeSessionId');
    const gameId = localStorage.getItem('challengeGameId');
    if (!sessionId || !gameId) {
        // 没有进行中的 Session，加载历史成绩
        await loadAllChallengeProgress();
        return;
    }

    try {
        const response = await fetch(`/api/challenge/session/${sessionId}`);
        if (response.ok) {
            const data = await response.json();
            const session = data.session;
            if (session && session.status === 'active') {
                activeChallengeSession = sessionId;
                pollingGameId = gameId;
                activeSessionMap[gameId] = session;
                // 先加载历史成绩
                await loadAllChallengeProgress();
                // 启动轮询，检测是否完成
                startPollingSession();
                showToast('检测到进行中的挑战，继续完成！');
            } else if (session && session.status === 'completed') {
                // 已完成，刷新UI
                clearChallengeState();
                await loadAllChallengeProgress();
                updatePointsDisplay();
                updateWeightedPoints();
                showToast(`挑战完成！最佳成绩：${session.bestScore}`);
            } else {
                clearChallengeState();
                await loadAllChallengeProgress();
            }
        } else {
            clearChallengeState();
            await loadAllChallengeProgress();
        }
    } catch (error) {
        console.error('检查ChallengeSession失败:', error);
        clearChallengeState();
        await loadAllChallengeProgress();
    }
}

/**
 * 轮询 Session 状态
 */
function startPollingSession() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        if (!activeChallengeSession) {
            clearInterval(pollingInterval);
            return;
        }
        try {
            const response = await fetch(`/api/challenge/session/${activeChallengeSession}`);
            if (response.ok) {
                const data = await response.json();
                const session = data.session;

                // 更新 activeSessionMap 并刷新进度显示
                if (pollingGameId) {
                    activeSessionMap[pollingGameId] = session;
                    renderChallengeGames();
                }

                if (session.status === 'completed') {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    clearChallengeState();
                    await loadAllChallengeProgress();
                    updatePointsDisplay();
                    updateWeightedPoints();
                    showToast(`🎉 挑战完成！最佳成绩：${session.bestScore}`);
                } else if (session.status === 'expired') {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    clearChallengeState();
                    await loadAllChallengeProgress();
                    showToast('挑战已过期，请重新开始');
                }
            }
        } catch (error) {
            console.error('轮询Session失败:', error);
        }
    }, 2000);
}

/** 清除挑战状态 */
function clearChallengeState() {
    activeChallengeSession = null;
    if (pollingGameId) {
        delete activeSessionMap[pollingGameId];
    }
    pollingGameId = null;
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    localStorage.removeItem('challengeSessionId');
    localStorage.removeItem('challengeGameId');
    localStorage.removeItem('challengeActivityId');
}

/**
 * 报告游戏成绩到挑战 Session
 * 游戏结束时自动调用（通过 window.reportChallengeScore）
 * @param {number} score - 本局成绩
 */
async function reportScore(score) {
    const sessionId = localStorage.getItem('challengeSessionId');
    if (!sessionId) return { success: false, error: 'No active session' };

    try {
        const response = await fetch(`/api/challenge/session/${sessionId}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('报告成绩失败:', error);
        return { success: false, error: error.message };
    }
}

// 将 reportScore 暴露到全局
window.reportChallengeScore = reportScore;

/**
 * 重置挑战进度
 * 确认 → 检查重置次数 → 扣除已获得积分 → 同步服务端 → 清空记录
 * @param {string} gameId - 游戏ID
 * @async
 */
async function resetChallenge(gameId) {
    if (!confirm('确定要重置挑战吗？所有进度将被清空。')) {
        return;
    }
    
    const challengeData = userData.challenges[gameId];
    if (!challengeData || challengeData.resetsUsed >= activityConfig.challenge.resetChance) {
        showToast('重置次数已用完');
        return;
    }
    
    // 计算要扣除的积分
    let deductedPoints = 0;
    if (challengeData.bestScore !== null) {
        deductedPoints = calculateChallengePoints(gameId, challengeData.bestScore);
        userData.challengePoints = Math.max(0, userData.challengePoints - deductedPoints);
        userData.totalPoints = userData.challengePoints + userData.predictionPoints;
    }
    
    // 同步积分变更到服务端（使用正确的 API 格式）
    try {
        await fetch(`/api/user/${encodeURIComponent(userNickname)}/points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'challenge',
                amount: -deductedPoints,
                reason: `重置${gameId}挑战`
            })
        });
    } catch (error) {
        console.error('同步积分失败:', error);
        // 服务端不可用时本地数据仍然有效，下次加载时会尝试重新同步
    }
    
    // 重置挑战数据
    userData.challenges[gameId] = {
        rounds: [],
        bestScore: null,
        completed: false,
        resetsUsed: challengeData.resetsUsed + 1,
        inProgress: false
    };
    
    saveChallengeData();
    updatePointsDisplay();
    renderChallengeGames();
    updateWeightedPoints();
    
    showToast('挑战已重置');
}

/**
 * 计算挑战积分
 * - 得分类游戏（sort=desc）：score/maxScore * 100
 * - 用时类游戏（sort=asc）：maxScore/score * 50
 * - 有分数上限的游戏（如8比特街机）会先截断
 * - 最终乘以奖励倍数
 * @param {string} gameId - 游戏ID
 * @param {number} score - 原始成绩
 * @returns {number} 计算后的积分
 */
function calculateChallengePoints(gameId, score) {
    if (!activityConfig || !activityConfig.challenge) return 0;
    
    const game = activityConfig.challenge.games.find(g => g.id === gameId);
    if (!game) return 0;
    
    // 8比特街机有分数上限
    if (game.scoreCap && score > game.scoreCap) {
        score = game.scoreCap;
    }
    
    // 简单计算：按比例换算成积分
    const maxScore = game.maxScore;
    let points = 0;
    
    if (game.sort === 'asc') {
        // 时间越短积分越高（用时类）
        if (score > 0) {
            points = Math.round((maxScore / score) * 50);
        }
    } else {
        // 分数越高积分越高（得分类）
        points = Math.round((score / maxScore) * 100);
    }
    
    // 应用奖励倍数
    points = Math.round(points * (activityConfig.challenge.rewardMultiplier || 1));
    
    return Math.min(points, maxScore);
}

// ==================== 赛事预测模块 ====================

/** 构建 matchId（用于预测存储的 key） */
function getMatchId(match) {
    return `${match.team1}-vs-${match.team2}`;
}

/**
 * 渲染预测赛程
 * 布局：每组对阵上方显示 A/B组 + 比赛时间
 * 对阵行：左蓝方(缩写矩形块+全称+选手名，左对齐) | 对阵 | 右红方(选手名+全称+缩写矩形块，右对齐)
 * 预测前：蓝方蓝色渐变 / 红方红色渐变
 * 预测后：选中方绿色描边高亮 / 另一方灰色
 */
function renderPredictionSchedule() {
    const container = document.getElementById('scheduleSection');
    if (!activityConfig || !activityConfig.prediction || !activityConfig.prediction.schedule) return;

    const schedule = activityConfig.prediction.schedule;
    const teamsMap = {};
    activityConfig.prediction.teams.forEach(t => { teamsMap[t.id] = t; });

    const deadline = new Date(activityConfig.prediction.deadline);
    const isEnded = new Date() > deadline && !activityConfig.prediction.allowChange;
    // 锁定状态：已提交且未进入编辑模式时不可点击
    const isLocked = userData.predictionLocked && !isEnded;

    // 预测结算状态提示（活动结束后显示）
    let settlementBanner = '';
    if (isEnded) {
        if (userData.predictionSettled && userData.predictionSettled.pointsAwarded !== undefined) {
            const s = userData.predictionSettled;
            settlementBanner = `
                <div class="prediction-settlement-banner" style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: #fff; padding: 16px 20px; border-radius: 12px; margin-bottom: 16px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">🎉 预测已结算</div>
                    <div style="margin-top: 6px;">${s.correctCount}/${s.totalCount} 场预测正确，获得 <strong>${s.pointsAwarded}</strong> 预测积分！</div>
                </div>
            `;
        } else {
            settlementBanner = `
                <div class="prediction-settlement-banner" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 16px 20px; border-radius: 12px; margin-bottom: 16px; text-align: center; color: rgba(255,255,255,0.7);">
                    <div>⏳ 预测已截止</div>
                    <div style="margin-top: 4px; font-size: 13px;">管理员结算后，可在此查看预测结果</div>
                </div>
            `;
        }
    }

    /** 生成单场对阵HTML */
    function renderMatch(match) {
        const t1 = teamsMap[match.team1];
        const t2 = teamsMap[match.team2];
        if (!t1 || !t2) return '';

        const matchId = getMatchId(match);
        const picked = userData.predictions[matchId] || null;
        const t1Picked = picked === t1.id;
        const t2Picked = picked === t2.id;
        const hasPicked = picked !== null;
        const disabledCls = isEnded ? 'disabled' : '';
        const lockedCls = isLocked ? 'locked' : '';

        // 选中状态 class：已选中的绿色高亮，另一方灰色
        const t1StateCls = hasPicked ? (t1Picked ? 'picked' : 'unpicked') : '';
        const t2StateCls = hasPicked ? (t2Picked ? 'picked' : 'unpicked') : '';

        // 锁定或截止时不可点击
        const clickable = !isEnded && !isLocked;

        return `
            <div class="match-card ${disabledCls} ${lockedCls}" data-match-id="${matchId}">
                <!-- 组别 + 时间 在上方 -->
                <div class="match-card-header">
                    <span class="match-group-tag">${match.group}组</span>
                    <span class="match-time">${match.time}</span>
                </div>
                <!-- 对阵行：蓝方 | 对阵 | 红方 -->
                <div class="match-teams-row">
                    <!-- 左蓝方 -->
                    <div class="match-team-side match-team-blue ${t1StateCls} ${disabledCls} ${lockedCls}"
                         onclick="${clickable ? `pickWinner('${matchId}', '${t1.id}')` : ''}"
                         data-team="${t1.id}">
                        <div class="team-block" style="background-color: ${t1.color};">
                            <span class="team-block-abbr">${t1.abbr}</span>
                        </div>
                        <div class="team-text">
                            <div class="team-text-name">${t1.name}</div>
                            <div class="team-text-players">${t1.players.join(' / ')}</div>
                        </div>
                    </div>
                    <!-- 中间"对阵" -->
                    <div class="match-vs-divider">
                        <span>对阵</span>
                    </div>
                    <!-- 右红方 -->
                    <div class="match-team-side match-team-red ${t2StateCls} ${disabledCls} ${lockedCls}"
                         onclick="${clickable ? `pickWinner('${matchId}', '${t2.id}')` : ''}"
                         data-team="${t2.id}">
                        <div class="team-text">
                            <div class="team-text-name">${t2.name}</div>
                            <div class="team-text-players">${t2.players.join(' / ')}</div>
                        </div>
                        <div class="team-block" style="background-color: ${t2.color};">
                            <span class="team-block-abbr">${t2.abbr}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        ${settlementBanner}
        <div class="schedule-block">
            <h3 class="schedule-title">
                <span class="schedule-live-badge">📺 直播</span>
                主舞台
            </h3>
            <div class="match-list">
                ${schedule.mainStage.map(renderMatch).join('')}
            </div>
        </div>
        <div class="schedule-block">
            <h3 class="schedule-title schedule-title-sub">
                副舞台
                <span class="schedule-no-live-badge">不直播</span>
            </h3>
            <div class="match-list">
                ${schedule.subStage.map(renderMatch).join('')}
            </div>
        </div>
    `;

    updatePredictionProgress();
}

/**
 * 选择某场对阵的胜者（仅在编辑模式或首次预测时可用）
 * @param {string} matchId - 对阵ID
 * @param {string} teamId - 选择的队伍ID
 */
function pickWinner(matchId, teamId) {
    const deadline = new Date(activityConfig.prediction.deadline);
    if (new Date() > deadline && !activityConfig.prediction.allowChange) {
        showToast('预测已截止');
        return;
    }

    // 如果已选同一队，取消选择
    if (userData.predictions[matchId] === teamId) {
        delete userData.predictions[matchId];
    } else {
        userData.predictions[matchId] = teamId;
    }

    savePredictionData();
    renderPredictionSchedule();
}

/**
 * 预测按钮主操作入口（单一状态机）
 * - 编辑中（predictionLocked=false）：确认提交 → 锁定
 * - 已锁定（predictionLocked=true）：点击"更改预测" → 解锁编辑
 */
async function handlePredictionAction() {
    const deadline = new Date(activityConfig.prediction.deadline);
    if (new Date() > deadline && !activityConfig.prediction.allowChange) {
        showToast('预测已截止');
        return;
    }

    const total = getTotalMatchCount();

    // 状态1：已锁定 → 点击"更改预测"解锁
    if (userData.predictionLocked) {
        if (!confirm('确定要更改预测吗？更改后可重新选择对阵胜者。')) return;
        userData.predictionLocked = false;
        savePredictionLocked();
        renderPredictionSchedule();
        showToast('现在可以修改预测了，完成后点击"确认提交"');
        return;
    }

    // 状态2：编辑中 → 确认提交
    const picked = Object.keys(userData.predictions).length;
    if (picked === 0) {
        showToast('请至少选择一场对阵的胜者');
        return;
    }

    // 判断是否首次提交（localStorage 中没有 predictionLocked 记录 = 首次）
    const wasPreviouslyLocked = localStorage.getItem(`early-summer-prediction-locked-${userNickname}`) !== null;
    const isFirstSubmit = !wasPreviouslyLocked;

    const participateReward = activityConfig.prediction.participateReward || 5;
    const totalReward = picked * participateReward;
    const confirmMsg = isFirstSubmit
        ? `你已选择了 ${picked}/${total} 场对阵的胜者，提交后将获得 ${totalReward} 参与积分（每场5积分），确定提交吗？`
        : `你已更新了 ${picked}/${total} 场对阵的预测，确定提交吗？`;

    if (!confirm(confirmMsg)) return;

    // 提交到服务端
    try {
        const response = await fetch('/api/activity/early-summer-challenge/prediction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nickname: userNickname,
                predictions: userData.predictions
            })
        });

        if (response.ok) {
            const data = await response.json();
            // 成功提交后重新加载服务端积分（服务端已自动发放奖励）
            await loadUserData();
            showToast(isFirstSubmit ? `预测提交成功！获得 ${data.pointsAwarded || totalReward} 参与积分` : '预测已更新！');
        } else {
            throw new Error('提交失败');
        }
    } catch (error) {
        console.error('提交预测失败，使用本地模拟:', error);
        // 服务端不可用时本地模拟：首次提交给参与积分（每场5积分）
        if (isFirstSubmit) {
            const participateReward = activityConfig.prediction.participateReward || 5;
            userData.predictionPoints = (userData.predictionPoints || 0) + totalReward;
            userData.totalPoints = userData.challengePoints + userData.predictionPoints;
        }
        // 尝试同步本地积分到服务端（使用正确的 API 格式）
        try {
            await fetch(`/api/user/${encodeURIComponent(userNickname)}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'prediction',
                    amount: isFirstSubmit ? totalReward : 0,
                    reason: '预测提交（本地离线模式）'
                })
            });
        } catch (syncError) {
            console.error('同步积分到服务端也失败:', syncError);
        }
    }

    // 锁定预测
    userData.predictionLocked = true;
    savePredictionLocked();
    savePredictionData();
    updatePointsDisplay();
    renderPredictionSchedule();
    updateWeightedPoints();

    if (!isFirstSubmit) {
        showToast('预测已更新！');
    }
}

/**
 * 更新预测进度和按钮显示
 */
function updatePredictionProgress() {
    const total = getTotalMatchCount();
    const picked = Object.keys(userData.predictions).length;
    document.getElementById('predictedCount').textContent = picked;

    const btn = document.getElementById('predictionSubmitBtn');
    if (userData.predictionLocked) {
        // 已锁定 → 显示"更改预测"
        btn.textContent = '✏️ 更改预测';
        btn.classList.add('locked-state');
        btn.classList.remove('ready');
    } else if (picked === total) {
        btn.textContent = '✅ 确认提交（已完成选择）';
        btn.classList.add('ready');
        btn.classList.remove('locked-state');
    } else {
        btn.textContent = `✅ 确认提交（${picked}/${total}）`;
        btn.classList.remove('ready');
        btn.classList.remove('locked-state');
    }
}

/** 获取总对阵数 */
function getTotalMatchCount() {
    if (!activityConfig || !activityConfig.prediction || !activityConfig.prediction.schedule) return 0;
    return activityConfig.prediction.schedule.mainStage.length + activityConfig.prediction.schedule.subStage.length;
}

// ==================== 宝石抽奖模块 ====================

/**
 * 更新抽奖模块UI状态
 * 抽奖在预测截止后自动解锁（服务端确认结果后可抽奖）
 * 也可通过后端 API 手动控制解锁
 * 更新分享按钮状态和加成显示
 */
function updateLotteryStatus() {
    const lockedDiv = document.getElementById('lotteryLocked');
    const contentDiv = document.getElementById('lotteryContent');
    
    // 自动判断：预测截止时间已过则自动解锁抽奖
    const isAutoUnlocked = activityConfig && activityConfig.prediction
        && new Date() > new Date(activityConfig.prediction.deadline);
    
    if (isAutoUnlocked && !userData.lotteryUnlocked) {
        userData.lotteryUnlocked = true;
        localStorage.setItem('early-summer-lottery-unlocked', 'true');
    }
    
    if (userData.lotteryUnlocked) {
        lockedDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        
        // 更新分享按钮状态
        const shareBtn = document.getElementById('shareBtn');
        if (userData.shared) {
            shareBtn.classList.add('completed');
            shareBtn.textContent = '✅ 已分享';
            shareBtn.disabled = true;
        }
        
        // 更新分享加成显示
        const shareBonusItem = document.getElementById('shareBonusItem');
        if (userData.shared) {
            shareBonusItem.style.display = 'flex';
        }
    } else {
        lockedDiv.style.display = 'block';
        contentDiv.style.display = 'none';
    }
}

/**
 * 更新加权积分显示
 * 加权积分 = 挑战积分×0.75 + 预测积分×0.25
 * 已分享则整体 ×1.2
 */
function updateWeightedPoints() {
    if (!activityConfig || !activityConfig.lottery) return;
    
    const config = activityConfig.lottery;
    const weightedChallenge = Math.round(userData.challengePoints * config.challengeWeight);
    const weightedPrediction = Math.round(userData.predictionPoints * config.predictionWeight);
    
    let weightedTotal = weightedChallenge + weightedPrediction;
    if (userData.shared) {
        weightedTotal = Math.round(weightedTotal * config.shareBonus);
    }
    
    document.getElementById('weightedChallenge').textContent = weightedChallenge;
    document.getElementById('weightedPrediction').textContent = weightedPrediction;
    document.getElementById('weightedTotal').textContent = weightedTotal;
}

/**
 * 处理分享操作
 * 复制分享文案到剪贴板 → 标记已分享 → 激活 1.2 倍加成
 */
function handleShare() {
    if (userData.shared) {
        showToast('你已经分享过了');
        return;
    }
    
    const shareText = `来玩Oline荒野游戏客栈，能联机对战、冲全服排行榜，参与活动还能抽宝石奖励！${window.location.origin}`;
    
    // 复制到剪贴板
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            userData.shared = true;
            saveSharedData();
            updateLotteryStatus();
            updateWeightedPoints();
            showToast('分享文案已复制！抽奖权重+20%');
        }).catch(() => {
            // 降级方案
            fallbackCopy(shareText);
        });
    } else {
        fallbackCopy(shareText);
    }
}

/**
 * 降级复制方案（不支持 clipboard API 时使用）
 * 创建隐藏 textarea → 选中 → execCommand('copy') → 移除
 * @param {string} text - 要复制的文本
 */
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        userData.shared = true;
        saveSharedData();
        updateLotteryStatus();
        updateWeightedPoints();
        showToast('分享文案已复制！抽奖权重+20%');
    } catch (err) {
        showToast('复制失败，请手动复制');
    }
    
    document.body.removeChild(textarea);
}

/** 前往作者主页（预留功能） */
function goToAuthorPage() {
    showToast('正在前往作者主页...');
    // 这里可以跳转到作者主页
    // window.location.href = 'author.html';
}

/**
 * 处理抽奖
 * 检查开放状态 → 检查积分 → POST /api/lottery/draw → 显示结果 → 首次生成挑战码
 * @async
 */
async function handleLottery() {
    if (!userData.lotteryUnlocked) {
        showToast('抽奖暂未开放');
        return;
    }
    
    const cost = activityConfig.lottery.cost;
    if (userData.totalPoints < cost) {
        showToast('积分不足，无法抽奖');
        return;
    }
    
    try {
        const response = await fetch('/api/lottery/draw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: userNickname,
                activityId: 'early-summer-challenge'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // 重新加载用户积分
            await loadUserData();
            updatePointsDisplay();
            
            // 显示结果
            showLotteryResult({ name: data.prize });
            
            // 生成挑战码（第一次抽奖时生成）
            if (!userData.challengeCode) {
                generateChallengeCode();
            }
        } else {
            const errorData = await response.json();
            showToast(errorData.error || '抽奖失败');
        }
    } catch (error) {
        console.error('抽奖失败:', error);
        showToast('抽奖失败，请稍后重试');
    }
}

/**
 * 执行抽奖逻辑（按概率随机）
 * @returns {Object|null} 奖品对象 { name, probability }
 */
function drawPrize() {
    if (!activityConfig || !activityConfig.lottery) return null;
    
    const prizes = activityConfig.lottery.prizes;
    const random = Math.random();
    let cumulative = 0;
    
    for (const prize of prizes) {
        cumulative += prize.probability;
        if (random <= cumulative) {
            return prize;
        }
    }
    
    return prizes[prizes.length - 1];
}

/**
 * 显示抽奖结果弹窗
 * @param {Object} prize - 奖品对象 { name }
 */
function showLotteryResult(prize) {
    const modal = document.getElementById('lotteryResultModal');
    const prizeEl = document.getElementById('lotteryPrize');
    const remainingEl = document.getElementById('remainingPoints');
    
    prizeEl.textContent = prize.name;
    remainingEl.textContent = userData.totalPoints;
    
    modal.classList.remove('hidden');
}

/** 关闭抽奖结果弹窗 */
function closeLotteryResult() {
    document.getElementById('lotteryResultModal').classList.add('hidden');
}

/**
 * 生成挑战码
 * 基于 昵称+加权积分+时间戳 的哈希值，转为8位大写字母数字
 * 首次抽奖后自动生成，用于兑奖凭证
 */
function generateChallengeCode() {
    if (!activityConfig || !activityConfig.lottery) return;
    
    const config = activityConfig.lottery;
    const weightedChallenge = Math.round(userData.challengePoints * config.challengeWeight);
    const weightedPrediction = Math.round(userData.predictionPoints * config.predictionWeight);
    let weightedTotal = weightedChallenge + weightedPrediction;
    if (userData.shared) {
        weightedTotal = Math.round(weightedTotal * config.shareBonus);
    }
    
    // 简单的挑战码生成：昵称+积分的哈希
    const raw = `${userNickname}-${weightedTotal}-${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    // 转换为大写字母+数字的格式
    const code = Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').substring(0, 8);
    userData.challengeCode = code;
    
    // 显示挑战码
    const codeSection = document.getElementById('challengeCodeSection');
    const codeEl = document.getElementById('challengeCode');
    codeSection.style.display = 'block';
    codeEl.textContent = code;
    
}

/** 复制挑战码到剪贴板 */
function copyChallengeCode() {
    if (!userData.challengeCode) return;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(userData.challengeCode).then(() => {
            showToast('挑战码已复制');
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = userData.challengeCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('挑战码已复制');
    }
}

// ==================== Tab切换 ====================

/**
 * 切换Tab面板
 * 更新按钮激活状态 → 切换内容区显示
 * @param {string} tabName - Tab名称（challenge/prediction/lottery）
 */
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // 更新内容显示
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ==================== 倒计时 ====================

/**
 * 启动所有倒计时
 * 活动结束倒计时 + 预测截止倒计时，每秒更新
 */
function startCountdowns() {
    // 活动倒计时
    updateActivityCountdown();
    setInterval(updateActivityCountdown, 1000);
    
    // 预测倒计时
    updatePredictionCountdown();
    setInterval(updatePredictionCountdown, 1000);
}

/** 更新活动结束倒计时显示（天/时/分/秒） */
function updateActivityCountdown() {
    if (!activityConfig) return;
    
    const now = new Date();
    const endTime = new Date(activityConfig.endTime);
    const diff = endTime - now;
    
    const countdownEl = document.getElementById('activityCountdown');
    
    if (diff <= 0) {
        countdownEl.textContent = '活动已结束';
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    countdownEl.textContent = `距离结束：${days}天 ${hours}时 ${minutes}分 ${seconds}秒`;
}

/** 更新预测截止倒计时显示，截止后标记 ended 样式 */
function updatePredictionCountdown() {
    if (!activityConfig || !activityConfig.prediction) return;
    
    const now = new Date();
    const deadline = new Date(activityConfig.prediction.deadline);
    const diff = deadline - now;
    
    const countdownEl = document.getElementById('predictionCountdown');
    
    if (diff <= 0) {
        countdownEl.textContent = '预测已截止';
        countdownEl.classList.add('ended');
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    countdownEl.textContent = `预测截止倒计时：${days}天 ${hours}时 ${minutes}分 ${seconds}秒`;
}

// ==================== 排行榜系统 ====================

/** 打开排行榜弹窗并加载标签 */
function showLeaderboard() {
    const modal = document.getElementById('leaderboardModal');
    modal.classList.remove('hidden');
    
    // 加载排行榜标签
    loadLeaderboardTabs();
}

/** 关闭排行榜弹窗 */
function closeLeaderboard() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}

/**
 * 加载排行榜标签
 * 根据活动配置中的游戏列表动态生成标签按钮，默认加载第一个
 */
function loadLeaderboardTabs() {
    const tabsContainer = document.getElementById('leaderboardTabs');
    if (!activityConfig || !activityConfig.challenge) return;
    
    const games = activityConfig.challenge.games;
    
    tabsContainer.innerHTML = games.map((game, index) => `
        <button class="leaderboard-tab ${index === 0 ? 'active' : ''}" 
                onclick="switchLeaderboardTab('${game.id}', this)">
            ${game.name}
        </button>
    `).join('');
    
    // 默认加载第一个游戏的排行榜
    if (games.length > 0) {
        loadLeaderboard(games[0].id);
    }
}

/**
 * 切换排行榜游戏标签
 * @param {string} gameId - 游戏ID
 * @param {HTMLElement} btn - 被点击的按钮元素
 */
function switchLeaderboardTab(gameId, btn) {
    // 更新标签状态
    document.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    btn.classList.add('active');
    
    // 加载对应排行榜
    loadLeaderboard(gameId);
}

/**
 * 加载排行榜数据
 * GET /api/leaderboard/:gameId → 渲染列表
 * @async
 * @param {string} gameId - 游戏ID
 */
async function loadLeaderboard(gameId) {
    const listContainer = document.getElementById('leaderboardList');
    listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">加载中...</div>';
    
    try {
        const response = await fetch(`/api/leaderboard/${gameId}`);
        if (response.ok) {
            const data = await response.json();
            renderLeaderboardList(data, gameId);
        } else {
            throw new Error('加载失败');
        }
    } catch (error) {
        console.error('加载排行榜失败:', error);
        // 显示空状态
        listContainer.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">🎯</div>
                <p>暂无排行记录</p>
                <p style="font-size:12px;margin-top:5px;">快去挑战成为第一名吧！</p>
            </div>
        `;
    }
}

/**
 * 渲染排行榜列表
 * 前3名显示金/银/铜色，其余显示灰色
 * @param {Object} data - 排行榜响应数据 { scores: [{ nickname, score }] }
 * @param {string} gameId - 游戏ID（用于获取分数单位）
 */
function renderLeaderboardList(data, gameId) {
    const listContainer = document.getElementById('leaderboardList');
    // API 返回 data.leaderboard（排行榜数组），而非 data.scores
    const scores = data.leaderboard || data.scores || [];
    
    if (scores.length === 0) {
        listContainer.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">🎯</div>
                <p>暂无排行记录</p>
                <p style="font-size:12px;margin-top:5px;">快去挑战成为第一名吧！</p>
            </div>
        `;
        return;
    }
    
    const unit = getScoreUnit(gameId);
    
    listContainer.innerHTML = scores.map((item, index) => {
        const rank = index + 1;
        let rankClass = 'rank-other';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        
        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${rankClass}">${rank}</div>
                <div class="leaderboard-name">${item.nickname || '匿名玩家'}</div>
                <div class="leaderboard-score">${item.score}
                    <span class="leaderboard-unit">${unit}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== 积分规则弹窗 ====================

/** 打开积分规则弹窗 */
function showRules() {
    const modal = document.getElementById('rulesModal');
    modal.classList.remove('hidden');
    renderRules();
}

/** 关闭积分规则弹窗 */
function closeRules() {
    document.getElementById('rulesModal').classList.add('hidden');
}

/** 渲染积分规则 */
function renderRules() {
    const container = document.getElementById('rulesContainer');
    if (!activityConfig || !activityConfig.challenge) return;
    
    const games = activityConfig.challenge.games;
    
    container.innerHTML = games.map(game => {
        const ruleDesc = game.sort === 'asc' 
            ? `用时越短积分越高，最高${game.maxScore}积分`
            : `分数越高积分越高，最高${game.maxScore}积分`;

        const formulaDesc = game.sort === 'asc'
            ? `积分 = (${game.maxScore}/用时) × 50`
            : `积分 = (得分/${game.maxScore}) × 100`;

        return `
            <div class="rules-item">
                <div class="rules-item-header">
                    <span class="rules-game-icon">${game.icon}</span>
                    <span class="rules-game-name">${game.name}</span>
                    <span class="rules-game-difficulty">${game.difficulty}</span>
                </div>
                <div class="rules-item-body">
                    <div class="rules-desc">${ruleDesc}</div>
                    <div class="rules-formula">${formulaDesc}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== 通用工具 ====================

/**
 * 显示Toast提示
 * 自动2.5秒后消失
 * @param {string} message - 提示文字
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ==================== 事件监听 ====================

/** 点击弹窗外部遮罩关闭弹窗 */
document.addEventListener('click', function(e) {
    // 排行榜弹窗
    const leaderboardModal = document.getElementById('leaderboardModal');
    if (e.target === leaderboardModal) {
        closeLeaderboard();
    }
    
    // 抽奖结果弹窗
    const lotteryModal = document.getElementById('lotteryResultModal');
    if (e.target === lotteryModal) {
        closeLotteryResult();
    }
    
    // 积分规则弹窗
    const rulesModal = document.getElementById('rulesModal');
    if (e.target === rulesModal) {
        closeRules();
    }
});
