require('dotenv').config({
    path: process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env.production'
});

const express = require('express');
const http = require('http');
const dbConnection = require('./db');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const socketIo = require('socket.io');
const redis = require("redis");

const app = express();
const server = http.createServer(app);
const redisClient = redis.createClient();

redisClient.connect();

const allowedOrigins = ['https://tabletrouble.com', 'https://staging.tabletrouble.com'];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true,
    }
});

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

                // console.log(`DB: Game Room Created: Game Code - ${gameCode}, Player - ${sanitizedPlayerName}, Session ID - ${sessionId}`);

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

        // console.log('DB: Constructed game data:', gameData);

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

                // console.log('DB: Player joined. Constructed game data:', gameData);

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

                // console.log('DB: Player kicked. Constructed game data:', gameData);

                res.status(200).json({
                    success: true,
                    updatedGameData: gameData,
                });
            });
        });
    });
});


app.get('/api/locations', (req, res) => {
    dbConnection.query('SELECT * FROM spyx_locations', (err, result) => {
        if (err) {
            console.error('Error fetching locations:', err);
            return res.status(500).json({ error: 'Error fetching locations' });
        }
        res.json(result);
    });
});

app.get("/api/player-info", async (req, res) => {
    const { gameCode, sessionId } = req.query;

    let room = await getRoomFromRedis(gameCode);
    let player = room?.players.find(p => p.player_session_id === sessionId);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    res.json({ role: player.role, location: player.location });
});


const cookie = require("cookie");

const getRandomLocation = (locations) => {
    const randomIndex = Math.floor(Math.random() * locations.length);
    return locations[randomIndex];
};

const getRoomFromRedis = async (gameCode) => {
    const data = await redisClient.get(`room:${gameCode}`);
    return data ? JSON.parse(data) : null;
};

const storeRoomInRedis = async (gameCode, roomData) => {
    roomData.last_updated = Date.now();
    await redisClient.setEx(`room:${gameCode}`, 1800, JSON.stringify(roomData));

    // Check for room expiration, redirect players
    setTimeout(async () => {
        const roomExists = await redisClient.get(`room:${gameCode}`);
        if (!roomExists) {
            console.log(`Room ${gameCode} expired, notifying players.`);
            io.to(gameCode).emit("roomExpired");
        }
    }, 1801000);
};

const deleteRoomFromRedis = async (gameCode) => {
    await redisClient.del(`room:${gameCode}`);
};

io.on("connection", async (socket) => {
    console.log("A player connected, socketID:", socket.id);

    if (socket.request.headers.cookie) {
        const parsedCookies = cookie.parse(socket.request.headers.cookie);
        const sessionIdFromCookie = parsedCookies.session_id || null;
        console.log("sessionIdFromCookie:", sessionIdFromCookie);

        if (sessionIdFromCookie) {
            const keys = await redisClient.keys("room:*");

            for (let key of keys) {
                let roomData = await getRoomFromRedis(key.replace("room:", ""));
                if (!roomData) continue;

                let player = roomData.players.find(p => p.player_session_id === sessionIdFromCookie);   // Check if the player exists in this room

                if (player) {
                    console.log(`Reconnecting player ${player.player_name} to room ${roomData.game_code}`);

                    player.socketId = socket.id;

                    await storeRoomInRedis(roomData.game_code, roomData);

                    socket.join(roomData.game_code);    // Rejoin the room

                    io.to(roomData.game_code).emit("updateGameData", { gameCode: roomData.game_code, players: roomData.players });

                    break;
                }
            }
        }
    }

    socket.on("joinRoom", async ({ gameCode, playerName, sessionId }) => {
        console.log(`Player ${playerName} with session ${sessionId} is joining room ${gameCode}`);

        let room = await redisClient.get(`room:${gameCode}`);
        room = room ? JSON.parse(room) : null;

        if (!room) {
            room = {
                game_code: gameCode,
                creator_session_id: sessionId,
                players: [],
                last_updated: Date.now()
            };
        }

        const existingPlayer = room.players.find(player => player.player_session_id === sessionId);     // Safety check if the player is not already in the room
        if (!existingPlayer) {
            room.players.push({
                player_name: playerName,
                player_session_id: sessionId,
                socketId: socket.id
            });

            room.last_updated = Date.now();

            await storeRoomInRedis(gameCode, room);
        }

        socket.join(gameCode);

        io.to(gameCode).emit("updateGameData", { gameCode, players: room.players });

        console.log(`Updated room ${gameCode} in Redis:`, room);
    });

    socket.on("kickPlayer", async ({ gameCode, playerSessionId }) => {
        console.log(`Attempting to kick player ${playerSessionId} from room ${gameCode}`);

        let room = await getRoomFromRedis(gameCode);
        if (!room) return;

        const playerToKick = room.players.find(player => player.player_session_id === playerSessionId);

        if (playerToKick) {
            io.to(playerToKick.socketId).emit("kickedFromRoom");

            room.players = room.players.filter(player => player.player_session_id !== playerSessionId);

            if (room.players.length === 0) {
                console.log(`Room ${gameCode} is now empty. Deleting...`);
                await deleteRoomFromRedis(gameCode);
            } else {
                room.last_updated = Date.now();
                await storeRoomInRedis(gameCode, room);

                console.log(`Updated room ${gameCode} in Redis after kick:`, room);
            }

            io.to(gameCode).emit("updateGameData", { gameCode, players: room.players });

        } else {
            console.error(`Player ${playerSessionId} not found in room ${gameCode}`);
        }
    });

    socket.on("assignRoles", async ({ gameCode, locations }) => {
        console.log("Assigning roles for game:", gameCode);

        let room = await getRoomFromRedis(gameCode);
        if (!room) {
            console.error(`Room ${gameCode} not found in Redis.`);
            return;
        }

        const players = room.players;
        console.log("Players in the game:", players);
        // console.log("Locations received from frontend:", locations);

        if (!locations || locations.length === 0) {
            console.error("No locations received!");
            return;
        }

        const commonLocation = getRandomLocation(locations);
        console.log("Selected common location for non-Spy players:", commonLocation);

        const spyPlayer = players[Math.floor(Math.random() * players.length)];
        console.log("Spy player selected:", spyPlayer.player_name);

        const query = 'SELECT * FROM spyx_roles WHERE location_id = ?';
        dbConnection.query(query, [commonLocation.id], async (err, roles) => {
            if (err) {
                console.error("Error fetching roles for location:", err);
                return;
            }

            // console.log(`Roles for location (id: ${commonLocation.id}):`, roles);

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

            room.players = updatedPlayers;
            room.last_updated = Date.now();
            await storeRoomInRedis(gameCode, room);

            io.to(gameCode).emit("updateGameData", {
                gameCode,
                players: updatedPlayers,
            });

            console.log("Updated players with roles and locations:", updatedPlayers);

            io.to(gameCode).emit("startGameFeedback", {
                waitingMessage: "Your fate has been determined",
                messageClass: "role-assigned",
                updatedPlayers: updatedPlayers,
            });
        });
    });

    socket.on("shufflePlayers", async ({ gameCode, shuffledPlayers }) => {
        let room = await getRoomFromRedis(gameCode);
        if (!room) {
            console.error(`Room ${gameCode} not found in Redis.`);
            return;
        }

        room.players = shuffledPlayers;
        room.last_updated = Date.now();
        await storeRoomInRedis(gameCode, room);

        console.log("updateGameData from shuffle players")
        io.to(gameCode).emit("updateGameData", { gameCode, players: shuffledPlayers });

        // console.log(`Updated shuffled players for game ${gameCode}:`, shuffledPlayers);
    });


});


const port = process.env.PORT || (process.env.NODE_ENV === 'staging' ? 4000 : 3000);
const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server running on port ${port} (${process.env.NODE_ENV} mode)`);
});