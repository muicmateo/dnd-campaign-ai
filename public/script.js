// --- ELEMENT REFERENCES ---
const mainMenu = document.getElementById('main-menu');
const gameContainer = document.getElementById('game-container');
const adventureSetup = document.getElementById('adventure-setup');
const creatorWizard = document.getElementById('creator-wizard');
const loginScreen = document.getElementById('login-screen');
const storyLog = document.getElementById('story-log');
const actionInput = document.getElementById('action-input');
const sendButton = document.getElementById('send-button');
const thinkingIndicator = document.getElementById('thinking-indicator');
const creatorBtn = document.getElementById('creator-btn');
const adventureBtn = document.getElementById('adventure-btn');
const gameTitle = document.getElementById('game-title');
const diceRollerUI = document.getElementById('dice-roller-ui');
const rollReason = document.getElementById('roll-reason');
const rollAutoBtn = document.getElementById('roll-auto-btn');
const rollManualInput = document.getElementById('roll-manual-input');
const rollSubmitBtn = document.getElementById('roll-submit-btn');
const customWorldInput = document.getElementById('custom-world-input');
const startCustomBtn = document.getElementById('start-custom-btn');
const startRandomBtn = document.getElementById('start-random-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const creatorBackBtn = document.getElementById('creator-back-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const creatorBackBtnFromLogin = document.getElementById('creator-back-btn-from-login');
const raceSelect = document.getElementById('race-select');
const classSelect = document.getElementById('class-select');


// --- API CONFIG ---
const DND_API_DOMAIN = 'https://dndapi.ashleysheridan.co.uk'; 

// --- STATE MANAGEMENT ---
let currentMode = 'menu';
let conversationHistory = [];
let pendingRoll = null;
let gameState = {};

// --- UI FUNCTIONS ---
function addMessageToLog(message, sender) {
    const messageText = message || "(The DM stays silent...)";
    const entry = document.createElement('div');
    entry.classList.add('log-entry', sender);
    entry.innerHTML = marked.parse(messageText);
    storyLog.appendChild(entry);
    storyLog.scrollTop = storyLog.scrollHeight;
}

function showDiceRoller(rollRequest) {
    pendingRoll = rollRequest;
    rollReason.textContent = `Roll for: ${rollRequest.reason}`;
    rollAutoBtn.textContent = `Roll ${rollRequest.dice_type}`;
    rollManualInput.value = '';
    diceRollerUI.classList.remove('hidden');
    actionInput.disabled = true;
    sendButton.disabled = true;
}

function hideDiceRoller() {
    pendingRoll = null;
    diceRollerUI.classList.add('hidden');
    actionInput.disabled = false;
    sendButton.disabled = false;
    actionInput.focus();
}

function showGameContainer(mode) {
    mainMenu.classList.add('hidden');
    adventureSetup.classList.add('hidden');
    creatorWizard.classList.add('hidden');
    loginScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    actionInput.focus();
    if (mode === 'adventure') {
        gameTitle.textContent = "Gemini D&D Adventure";
        actionInput.placeholder = "What do you do?";
    }
}

// --- CORE ADVENTURE LOGIC ---
async function startAdventure(type, customPrompt = '') {
    if (type === 'custom') startCustomBtn.textContent = 'Generating...';
    else startRandomBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch('/api/start-adventure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, customPrompt }),
        });
        if (!response.ok) throw new Error('Failed to start adventure.');
        const data = await response.json();
        const startingScene = data.startingScene;
        gameState = {
            character: {
                name: "Aelar",
                class: "Ranger",
                hp: 12,
                inventory: ["Longbow", "Quiver of 20 arrows", "Shortsword", "Rations"]
            },
            current_location: "An unknown starting point",
            session_log: [startingScene]
        };
        conversationHistory = [{ sender: 'AI', message: startingScene }];
        storyLog.innerHTML = '';
        addMessageToLog(startingScene, 'dm');
        currentMode = 'adventure';
        showGameContainer('adventure');
    } catch (error) {
        alert(error.message);
    } finally {
        startCustomBtn.textContent = 'Start in This World';
        startRandomBtn.textContent = 'Generate a Random World';
    }
}

async function handleAction(userInput) {
    if (!userInput) return;
    addMessageToLog(`> ${userInput}`, 'player');
    conversationHistory.push({ sender: 'User', message: userInput });
    if (currentMode === 'adventure') {
        gameState.session_log.push(`Player: ${userInput}`);
    }
    thinkingIndicator.classList.remove('hidden');
    sendButton.disabled = true;
    actionInput.disabled = true;
    try {
        const endpoint = '/api/action';
        const payload = { gameState, action: userInput };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'An unknown server error occurred.');
        }
        const data = await response.json();
        const aiNarrative = data.narrative || data.message;
        addMessageToLog(aiNarrative, 'dm');
        conversationHistory.push({ sender: 'AI', message: aiNarrative });
        if (currentMode === 'adventure') {
            gameState.session_log.push(`DM: ${aiNarrative}`);
        }
        if (data.rollRequest) {
            showDiceRoller(data.rollRequest);
        }
    } catch (error) {
        console.error("Error:", error);
        addMessageToLog(`<strong>Error:</strong> ${error.message}`, 'dm');
    } finally {
        thinkingIndicator.classList.add('hidden');
        if (!pendingRoll) {
            sendButton.disabled = false;
            actionInput.disabled = false;
            actionInput.focus();
        }
    }
}

// --- AUTHENTICATION & CREATOR LOGIC ---
async function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;
    loginError.classList.add('hidden');

    try {
        // NOTE: Login calls the external API directly from the browser, as it doesn't contain secrets.
        const response = await fetch(`${DND_API_DOMAIN}/api/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        localStorage.setItem('dnd_token', data.token);
        
        loginScreen.classList.add('hidden');
        creatorWizard.classList.remove('hidden');
        populateRaces();
        populateClasses();

    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    }
}

async function populateRaces() {
    try {
        const token = localStorage.getItem('dnd_token');
        if (!token) throw new Error("Not logged in");
        // This calls our own server, which then calls the D&D API with the token.
        const response = await fetch('/api/dnd/races', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        raceSelect.innerHTML = '<option value="">-- Select a Race --</option>';
        data.forEach(race => {
            const option = document.createElement('option');
            option.value = race.id;
            option.textContent = race.name;
            raceSelect.appendChild(option);
        });
    } catch (error) {
        raceSelect.innerHTML = `<option>${error.message}</option>`;
    }
}

async function populateClasses() {
     try {
        const token = localStorage.getItem('dnd_token');
        if (!token) throw new Error("Not logged in");
        const response = await fetch('/api/dnd/classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        classSelect.innerHTML = '<option value="">-- Select a Class --</option>';
        data.forEach(dndClass => {
            const option = document.createElement('option');
            option.value = dndClass.id;
            option.textContent = dndClass.name;
            classSelect.appendChild(option);
        });
    } catch (error) {
        classSelect.innerHTML = `<option>${error.message}</option>`;
    }
}

// --- EVENT LISTENERS ---
sendButton.addEventListener('click', () => {
    const userInput = actionInput.value;
    actionInput.value = '';
    handleAction(userInput);
});

actionInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const userInput = actionInput.value;
        actionInput.value = '';
        handleAction(userInput);
    }
});

rollAutoBtn.addEventListener('click', () => {
    if (!pendingRoll) return;
    const dice = parseInt(pendingRoll.dice_type.substring(1));
    const roll = Math.floor(Math.random() * dice) + 1;
    rollManualInput.value = roll;
});

rollSubmitBtn.addEventListener('click', () => {
    const rollValue = rollManualInput.value;
    if (!rollValue || !pendingRoll) return;
    const resultMessage = `(Rolled a ${rollValue} for ${pendingRoll.reason})`;
    hideDiceRoller();
    handleAction(resultMessage);
});

creatorBtn.addEventListener('click', () => {
    const token = localStorage.getItem('dnd_token');
    mainMenu.classList.add('hidden');
    if (token) {
        creatorWizard.classList.remove('hidden');
        populateRaces();
        populateClasses();
    } else {
        loginScreen.classList.remove('hidden');
    }
});

adventureBtn.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    adventureSetup.classList.remove('hidden');
});

startCustomBtn.addEventListener('click', () => {
    const customText = customWorldInput.value;
    if (!customText.trim()) {
        alert('Please describe your world before starting.');
        return;
    }
    startAdventure('custom', customText);
});

startRandomBtn.addEventListener('click', () => {
    startAdventure('random');
});

backToMenuBtn.addEventListener('click', () => {
    adventureSetup.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

creatorBackBtn.addEventListener('click', () => {
    creatorWizard.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

loginBtn.addEventListener('click', handleLogin);

creatorBackBtnFromLogin.addEventListener('click', () => {
    loginScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});