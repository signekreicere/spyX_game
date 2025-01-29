const express = require('express');
const http = require('http');
const dbConnection = require('./db');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: 'https://tabletrouble.com',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
};

const io = socketIo(server, {
    cors: corsOptions,
});

app.use(cookieParser());
app.use(express.json());
app.use(cors(corsOptions));

const sanitizeName = (name) => {
    return name.trim().replace(/[^a-zA-Z0-9 ]/g, "");
};

const generateGameCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
};

const { v4: uuidv4 } = require('uuid'); // Importing UUID to generate a unique session_id


app.post('/api/create-game', (req, res) => {
    const { playerName } = req.body;

    if (!playerName) {
        return res.status(400).json({ error: 'Player name is required' });
    }

    const sanitizedPlayerName = sanitizeName(playerName);
    const gameCode = generateGameCode();
    const sessionId = uuidv4();

    // Insert the new game into the database
    const insertGameQuery = 'INSERT INTO spyx_games (game_code) VALUES (?)';
    dbConnection.query(insertGameQuery, [gameCode], (err, gameResult) => {
        if (err) {
            console.error('Error creating game:', err);
            return res.status(500).json({ error: 'Error creating game' });
        }

        const gameId = gameResult.insertId;

        // Insert the player into the database for the created game
        const insertPlayerQuery = 'INSERT INTO spyx_players (name, game_id, session_id) VALUES (?, ?, ?)';
        dbConnection.query(insertPlayerQuery, [sanitizedPlayerName, gameId, sessionId], (err, playerResult) => {
            if (err) {
                console.error('Error adding player:', err);
                return res.status(500).json({ error: 'Error adding player' });
            }

            const playerId = playerResult.insertId;

            // Update the creator_id in the spyx_games table
            const updateCreatorQuery = 'UPDATE spyx_games SET creator_id = ? WHERE id = ?';
            dbConnection.query(updateCreatorQuery, [playerId, gameId], (err) => {
                if (err) {
                    console.error('Error updating creator_id:', err);
                    return res.status(500).json({ error: 'Error updating creator_id' });
                }

                console.log(`Game Room Created: Game Code - ${gameCode}, Player - ${sanitizedPlayerName}, Session ID - ${sessionId}`);

                res.cookie('session_id', sessionId, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Strict',
                });

                // Respond with the game data
                res.status(200).json({
                    message: 'Game created successfully',
                    gameCode,
                    playerName: sanitizedPlayerName,
                    sessionId,
                    gameId,
                    playerId
                });
            });
        });
    });
});

app.get('/api/game/:gameCode', (req, res) => {
    const { gameCode } = req.params;
    const sessionId = req.cookies.session_id;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    const query = `
        SELECT
            g.id AS game_id,
            g.game_code,
            g.creator_id,
            p.name AS player_name,
            p.session_id AS player_session_id,
            (SELECT session_id FROM spyx_players WHERE id = g.creator_id) AS creator_session_id
        FROM spyx_games g
                 JOIN spyx_players p ON g.id = p.game_id
        WHERE g.game_code = ?
    `;

    dbConnection.query(query, [gameCode], (err, result) => {
        if (err) {
            console.error('Error fetching game data:', err);
            return res.status(500).json({ error: 'Error fetching game data' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const gameData = {
            game_id: result[0].game_id,
            game_code: result[0].game_code,
            sessionId,
            creator_id: result[0].creator_id,
            creator_session_id: result[0].creator_session_id,
            isCreator: result[0].creator_session_id === sessionId,
            players: result.map(player => ({
                player_name: player.player_name,
                player_session_id: player.player_session_id,
            })),
        };

        const playerFound = result.some(player => player.player_session_id === sessionId);

        if (!playerFound) {
            return res.status(400).json({ error: 'Session ID is not associated with this game' });
        }

        console.log('Constructed game data:', gameData);

        res.status(200).json(gameData);
    });
});

app.post('/api/join-game', (req, res) => {
    const { playerName, gameCode } = req.body;

    if (!playerName) {
        return res.status(400).json({ error: 'Player name is required' });
    }

    if (!gameCode || gameCode.length !== 4) {
        return res.status(400).json({ error: 'Invalid game code' });
    }

    const sanitizedPlayerName = sanitizeName(playerName);

    // Check if the game exists
    const checkGameQuery = 'SELECT id FROM spyx_games WHERE game_code = ?';
    dbConnection.query(checkGameQuery, [gameCode], (err, gameResult) => {
        if (err) {
            console.error('Error checking game code:', err);
            return res.status(500).json({ error: 'Error checking game code' });
        }

        if (gameResult.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const gameId = gameResult[0].id;
        const sessionId = uuidv4(); // Generate new session ID for the player

        // Insert the player into the database for the specified game
        const insertPlayerQuery = 'INSERT INTO spyx_players (name, game_id, session_id) VALUES (?, ?, ?)';
        dbConnection.query(insertPlayerQuery, [sanitizedPlayerName, gameId, sessionId], (err, playerResult) => {
            if (err) {
                console.error('Error adding player:', err);
                return res.status(500).json({ error: 'Error adding player' });
            }

            // Fetch the updated player list
            const fetchPlayersQuery = `
                SELECT 
                       p.name AS player_name, p.session_id AS player_session_id
                FROM spyx_players p
                WHERE p.game_id = ?;
            `;
            dbConnection.query(fetchPlayersQuery, [gameId], (err, players) => {
                if (err) {
                    console.error("Error fetching updated player list:", err);
                    return res.status(500).json({ error: 'Error fetching player list' });
                }

                const gameData = {
                    game_id: gameId,
                    game_code: gameCode,
                    sessionId,
                    creator_id: gameResult[0].creator_id,
                    creator_session_id: gameResult[0].creator_session_id,
                    isCreator: gameResult[0].creator_session_id === sessionId,
                    players: players.map(player => ({
                        player_name: player.player_name,
                        player_session_id: player.player_session_id,
                    })),
                };

                res.cookie('session_id', sessionId, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Strict',
                });

                console.log('Player joined. Constructed game data:', gameData);

                // Respond with the game data and the new player info
                res.status(200).json(gameData);
            });
        });
    });
});

app.post('/api/kick-player', (req, res) => {
    const { playerSessionId, gameCode } = req.body;

    if (!playerSessionId || !gameCode) {
        return res.status(400).json({ error: "Player session ID and game code are required." });
    }

    // Find the game and the creator's session_id by joining spyx_games and spyx_players
    const getGameQuery = `
        SELECT g.id AS game_id, g.game_code, g.creator_id, p.session_id AS creator_session_id
        FROM spyx_games g
        JOIN spyx_players p ON p.id = g.creator_id
        WHERE g.game_code = ?
    `;
    dbConnection.query(getGameQuery, [gameCode], (err, gameResult) => {
        if (err) {
            console.error("Error fetching game:", err);
            return res.status(500).json({ error: "Error fetching game" });
        }

        if (gameResult.length === 0) {
            return res.status(404).json({ error: "Game not found" });
        }

        const game = gameResult[0];

        // Check if not creator of the game
        if (playerSessionId === game.creator_session_id) {
            return res.status(400).json({ error: "You cannot kick the creator." });
        }

        const deletePlayerQuery = `
            DELETE FROM spyx_players
            WHERE session_id = ? AND game_id = ?
        `;
        dbConnection.query(deletePlayerQuery, [playerSessionId, game.game_id], (err) => {
            if (err) {
                console.error("Error removing player:", err);
                return res.status(500).json({ error: "Error removing player from game" });
            }

            // Fetch updated player list
            const fetchPlayersQuery = `
                SELECT 
--                     p.id AS player_id, 
                    p.name AS player_name, p.session_id AS player_session_id
                FROM spyx_players p
                WHERE p.game_id = ?;
            `;
            dbConnection.query(fetchPlayersQuery, [game.game_id], (err, players) => {
                if (err) {
                    console.error("Error fetching updated players:", err);
                    return res.status(500).json({ error: "Error fetching updated players" });
                }

                // Construct game data to return
                const gameData = {
                    game_id: game.game_id,
                    game_code: game.game_code,
                    sessionId: playerSessionId,
                    creator_id: game.creator_id,
                    creator_session_id: game.creator_session_id,
                    isCreator: game.creator_session_id === playerSessionId,
                    players: players.map(player => ({
                        player_name: player.player_name,
                        player_session_id: player.player_session_id,
                    })),
                };

                console.log('Player kicked. Constructed game data:', gameData);

                res.status(200).json({
                    success: true,
                    updatedGameData: gameData,
                });
            });
        });
    });
});

app.get('/api/locations', (req, res) => {
    const query = 'SELECT * FROM spyx_locations';

    dbConnection.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching locations:', err);
            return res.status(500).json({ error: 'Error fetching locations' });
        }

        res.status(200).json(result);
    });
});


let rooms = {};

// Retrieves the game code and player's name based on their session ID
const getGameCodeFromSession = (sessionId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT g.game_code, p.name AS player_name
            FROM spyx_players p
            JOIN spyx_games g ON p.game_id = g.id
            WHERE p.session_id = ?
        `;

        dbConnection.query(query, [sessionId], (err, result) => {
            if (err) {
                console.error("Error fetching game code and player name:", err);
                return reject(err);
            }

            if (result.length > 0) {
                resolve({
                    gameCode: result[0].game_code,
                    playerName: result[0].player_name,
                });
            } else {
                reject("Game code and player name not found for session ID: " + sessionId);
            }
        });
    });
};

const getRandomLocation = (locations) => {
    const randomIndex = Math.floor(Math.random() * locations.length);
    return locations[randomIndex];
};

io.on("connection", (socket) => {
    console.log("A player connected: ", socket.id);

    const parsedCookies = socket.request.headers.cookie
        ? socket.request.headers.cookie.split(';').reduce((acc, cookie) => {
            const [name, value] = cookie.trim().split('=');
            acc[name] = value;
            return acc;
        }, {})
        : {};

    const sessionIdFromCookie = parsedCookies.session_id;
    console.log("sessionIdFromCookie:", sessionIdFromCookie);

    if (sessionIdFromCookie) {
        // Retrieve the gameCode and playerName using the session ID
        getGameCodeFromSession(sessionIdFromCookie)
            .then(({ gameCode, playerName }) => {

                if (gameCode && !rooms[gameCode]) {
                    rooms[gameCode] = [];
                }

                // Update players socketId
                if (gameCode) {

                    rooms[gameCode].forEach(player => {
                        if (player.player_session_id === sessionIdFromCookie) {
                            player.socketId = socket.id;
                            console.log("Updated player's socketId:", player);
                        }
                    });
                }

                // Push the new player
                const newPlayer = {
                    player_name: playerName,
                    player_session_id: sessionIdFromCookie,
                    socketId: socket.id,
                };
                rooms[gameCode].push(newPlayer);
                console.log("Added new player:", newPlayer);

                socket.join(gameCode);

            })
            .catch((error) => {
                console.log("Error retrieving game code:", error);
            });
    } else {
        console.log('New player connected: No session ID found!', socket.id);
    }


    socket.on("joinRoom", ({ gameCode, playerName, sessionId }) => {
        console.log(`Player ${playerName} with session ${sessionId} joined room ${gameCode}`);

        if (!rooms[gameCode]) {
            rooms[gameCode] = [];
        }

        // Adjust for expected data format
        const newPlayer = {
            player_name: playerName,
            player_session_id: sessionId,
            socketId: socket.id,
        };

        rooms[gameCode].push(newPlayer);
        socket.join(gameCode);

        const gameData = {
            gameCode,
            players: rooms[gameCode],
        };

        console.log(`Websocket join triggered. Current players in room ${gameCode}:`, rooms[gameCode]);

        io.to(gameCode).emit("updateGameData", gameData);
    });

    socket.on("kickPlayer", ({ gameCode, playerSessionId }) => {
        console.log(`Attempting to kick player with session ${playerSessionId} from room ${gameCode}`);

        const playerToKick = rooms[gameCode].find(player => player.player_session_id === playerSessionId);

        console.log("playerToKick: ", playerToKick);
        if (playerToKick) {
            const socketIdToKick = playerToKick.socketId;

            if (socketIdToKick) {
                io.to(socketIdToKick).emit("kickedFromRoom");

                rooms[gameCode] = rooms[gameCode].filter(player => player.player_session_id !== playerSessionId);

                const gameData = {
                    gameCode,
                    players: rooms[gameCode],
                };

                io.to(gameCode).emit("updateGameData", gameData);

                console.log(`Player with session ${playerSessionId} has been kicked from room ${gameCode}`);
            } else {
                console.error(`No socket ID found for player with session ${playerSessionId}`);
            }

        } else {
            console.error("Player not found in the room.");
        }
    });

    socket.on("assignRoles", ({ gameCode, locations }) => {
        const players = rooms[gameCode];

        console.log("Assigning roles for game:", gameCode);
        console.log("Players in the game:", players);
        console.log("Locations received from frontend:", locations);

        if (!locations || locations.length === 0) {
            console.error("No locations received!");
            io.to(gameCode).emit("roleAssigned", {
                message: "No locations available. Please try again later.",
                updatedPlayers: players,
            });
            return;
        }

        const commonLocation = getRandomLocation(locations);
        console.log("Selected common location for non-Spy players:", commonLocation);

        const spyPlayer = players[Math.floor(Math.random() * players.length)];
        console.log("Spy player selected:", spyPlayer.player_name);

        const query = 'SELECT * FROM spyx_roles WHERE location_id = ?';
        dbConnection.query(query, [commonLocation.id], (err, roles) => {
            if (err) {
                console.error("Error fetching roles for location:", err);
                return;
            }

            console.log(`Roles for location (id: ${commonLocation.id}):`, roles);

            const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);

            const updatedPlayers = players.map((player) => {
                const isSpy = player.player_session_id === spyPlayer.player_session_id;
                let assignedRole = null;

                if (!isSpy && shuffledRoles.length > 0) {
                    const roleObj = shuffledRoles.splice(0, 1)[0];
                    assignedRole = roleObj ? roleObj.role_name : "No Role";
                }

                return {
                    ...player,
                    role: isSpy ? "Spy" : assignedRole,
                    location: isSpy ? null : {
                        name: commonLocation.name,
                        id: commonLocation.id,
                    },
                };
            });

            rooms[gameCode] = updatedPlayers;

            io.to(gameCode).emit("roleAssigned", {
                updatedPlayers: updatedPlayers,
            });

            console.log("Updated players with roles and locations:", updatedPlayers);

            // Emit the startGameFeedback event to all players
            io.to(gameCode).emit("startGameFeedback", {
                waitingMessage: "Your fate has been determined",
                messageClass: "role-assigned",
            });
        });
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected: ", socket.id);

        for (let gameCode in rooms) {
            rooms[gameCode] = rooms[gameCode].filter(player => player.socketId !== socket.id);
        }
    });
});





const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
