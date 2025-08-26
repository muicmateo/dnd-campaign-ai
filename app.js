// 1. Import necessary libraries
require('dotenv').config();
const express = require('express');
const axios = require('axios'); // For third-party API calls
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- MODEL CONFIGURATION ---
const ADVENTURE_MODEL = 'gemini-2.5-flash';
const DND_API_DOMAIN = 'https://dndapi.ashleysheridan.co.uk';

// --- SAFETY SETTINGS CONFIGURATION ---
const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

// --- PROMPT DEFINITIONS ---
const DUNGEON_MASTER_PROMPT = `
Name: "Dungeon Master"
Description: "A helpful and engaging Dungeon Master for D&D 5th Edition."

Instruction:
Your purpose is to guide players through a D&D 5e adventure.

Core Principles:
- Be descriptive and immersive, using sensory details to set the mood and atmosphere.
- Focus on the player's experience and actions, keeping your descriptions clear and concise.
- Maintain a friendly, supportive tone and clearly separate player knowledge from character knowledge.

Specific Situations:
- Locations: Describe the environment, hinting at potential clues, hazards, or points of interest.
- NPCs: Roleplay them with distinct personalities, voices, and mannerisms. Adapt their dialogue and actions to the player's choices.
- Combat:
    - Manage combat using "theater of the mind" for positioning. Do not reveal enemy stats (AC, HP, etc.).
    - For ALL combat actions (attacks, damage, saves), show calculations in a single code block with the format: \`(Dice Roll + Modifiers = Result)\`.
- Skill Checks & Saving Throws:
    - Proactively call for checks when the situation demands it.
    - CRITICAL: When a player needs to roll, you MUST end your response with the following JSON command, and nothing after it:
    \`\`\`json
    {"roll_request": {"dice_type": "d20", "reason": "Name of Check or Save"}}
    \`\`\`
`;
// CHARACTER_CREATOR_PROMPT has been removed.


// 2. Configure the app
const app = express();
const port = 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const dndApiBaseUrl = 'https://dndapi.ashleysheridan.co.uk/api'; // D&D API base URL

// 3. Set up Middleware
app.use(express.static('public'));
app.use(express.json());

// --- D&D API ENDPOINTS (NOW AUTHENTICATED) ---
// This function will get the token from the frontend's request
const getAuthHeaders = (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('Authorization token is missing');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
};

app.get('/api/dnd/races', async (req, res) => {
    try {
        const headers = getAuthHeaders(req);
        const response = await axios.get(`${DND_API_DOMAIN}/api/characters/races`, { headers });
        res.json(response.data);
    } catch (error) {
        res.status(401).json({ error: 'Failed to fetch races: ' + error.message });
    }
});

app.get('/api/dnd/classes', async (req, res) => {
    try {
        const headers = getAuthHeaders(req);
        const response = await axios.get(`${DND_API_DOMAIN}/api/characters/classes`, { headers });
        res.json(response.data);
    } catch (error) {
        res.status(401).json({ error: 'Failed to fetch classes: ' + error.message });
    }
});

// --- EXISTING ADVENTURE ENDPOINTS ---
app.post('/api/action', async (req, res) => {
    try {
        const { gameState, action } = req.body;
        const modelName = ADVENTURE_MODEL;
        console.log(`--> Using Adventure model: ${modelName}`);
        
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings });

        const recentGameState = JSON.parse(JSON.stringify(gameState));
        if (recentGameState.session_log.length > 10) {
            recentGameState.session_log = recentGameState.session_log.slice(-10);
        }
        const prompt = `
        INSTRUCTIONS: You are the Dungeon Master. Your personality and rules are defined below.
        ${DUNGEON_MASTER_PROMPT}

        CURRENT GAME STATE:
        ${JSON.stringify(recentGameState, null, 2)}

        PLAYER ACTION:
        "${action}"

        YOUR RESPONSE:
        `;
        const result = await model.generateContent(prompt);
        let dmResponse = result.response.text();
        let rollRequest = null;
        let narrative = dmResponse;
        const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
        const match = dmResponse.match(jsonRegex);
        if (match && match[1]) {
            try {
                const parsedJson = JSON.parse(match[1]);
                rollRequest = parsedJson.roll_request;
                narrative = dmResponse.substring(0, match.index).trim();
            } catch (e) {
                narrative = dmResponse;
            }
        }
        res.json({ narrative, rollRequest });
    } catch (error) {
        console.error("Error in /api/action:", error);
        res.status(500).json({ error: "Something went wrong with the Dungeon Master!" });
    }
});

app.post('/api/start-adventure', async (req, res) => {
    try {
        const { type, customPrompt } = req.body;
        const model = genAI.getGenerativeModel({ model: ADVENTURE_MODEL, safetySettings });

        let setupPrompt = '';
        if (type === 'random') {
            setupPrompt = "You are a D&D Dungeon Master. Generate a compelling and random starting scene for a new adventure. Describe the player's immediate surroundings and the initial situation they are in. Be creative and engaging. Start the adventure directly with the scene's description.";
        } else {
            setupPrompt = `You are a D&D Dungeon Master acting as a creative writing assistant. Your task is to start a fantasy adventure. A user has provided a premise below. Use their premise to write an engaging opening scene. Describe the character's immediate surroundings and establish the initial situation.

            ---
            User's Premise: "${customPrompt}"
            ---

            Now, begin the adventure with the opening scene:`;
        }

        const result = await model.generateContent(setupPrompt);
        const startingScene = result.response.text();
        if (!startingScene) {
            throw new Error("The AI failed to generate a starting scene, possibly due to safety filters. Please try rephrasing your world description.");
        }
        res.json({ startingScene });
    } catch (error) {
        console.error("Error in /api/start-adventure:", error);
        res.status(500).json({ error: error.message || "Failed to generate a new world." });
    }
});


// 7. Start the server
app.listen(port, () => {
    console.log(`D&D server listening at http://localhost:${port}`);
});