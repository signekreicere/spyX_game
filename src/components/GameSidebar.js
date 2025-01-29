import React, { useEffect, useState } from "react";
import socket from "../socket";

const GameSidebar = ({ gameData, setGameData, locations }) => {
    const [showRole, setShowRole] = useState(false);
    const [isButtonDisabled, setIsButtonDisabled] = useState(true);
    const [startButtonLabel, setStartButtonLabel] = useState("Start Game");
    const [roleButtonLabel, setRoleButtonLabel] = useState("Show Role");
    const [roleButtonClass, setRoleButtonClass] = useState("");
    const [showCopiedMessage, setShowCopiedMessage] = useState(false);

    const handleKickPlayer = async (playerSessionId) => {
        try {
            const response = await fetch("/api/kick-player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerSessionId, gameCode: gameData.game_code }),
            });

            const data = await response.json();

            if (data.success) {
                console.log("Player kicked successfully.");

                setGameData((prevGameData) => ({
                    ...prevGameData,
                    players: data.updatedGameData.players,
                }));

                socket.emit("kickPlayer", {
                    gameCode: gameData.game_code,
                    playerSessionId: playerSessionId,
                });
            } else {
                console.error("Error kicking player:", data.error);
            }
        } catch (error) {
            console.error("Error kicking player:", error);
        }
    };

    const copyToClipboard = () => {
        const currentUrl = window.location.href;
        navigator.clipboard.writeText(currentUrl)
            .then(() => {
                setShowCopiedMessage(true);
                setTimeout(() => {
                    setShowCopiedMessage(false);
                }, 1000);
            })
    };

    const handleStartGame = () => {
        socket.emit("assignRoles", {
            gameCode: gameData.game_code,
            locations: locations,
        });

        setStartButtonLabel("Restart Game");

        document.querySelectorAll(".location-card").forEach(card => {
            card.classList.remove("selected");
        });
    };


    useEffect(() => {
        socket.on("roleAssigned", ({ updatedPlayers }) => {
            setGameData((prevGameData) => ({
                ...prevGameData,
                players: updatedPlayers,
            }));

            setIsButtonDisabled(false);

            document.querySelectorAll(".location-card").forEach(card => {
                card.classList.remove("current");
            });

            updatedPlayers.forEach(player => {
                if (player.player_session_id === gameData.sessionId && player.location?.id) {
                    const locationId = player.location.id;
                    const targetLocationElement = document.getElementById(`spyx-location-${locationId}`);
                    if (targetLocationElement) {
                        targetLocationElement.classList.add("current");
                    }
                }
            });
        });

        socket.on("startGameFeedback", ({ waitingMessage }) => {
            setRoleButtonLabel(waitingMessage);
            setRoleButtonClass("fade-effect");

            setTimeout(() => {
                setRoleButtonLabel(showRole ? "Hide Role" : "Show Role");
                setRoleButtonClass("");
            }, 3000);
        });

        return () => {
            socket.off("roleAssigned");
            socket.off("startGameFeedback");
        };
    }, [setGameData, showRole]);


    const toggleRoleVisibility = () => {
        setShowRole((prev) => {
            const newLabel = !prev ? "Hide Role" : "Show Role";
            setRoleButtonLabel(newLabel);

            console.log("Role button toggled. New label:", newLabel);
            return !prev;
        });
    };

    const canAssignRoles = gameData.players.length >= 2;

    return (
        <div className="sidebar">
            <div class="sidebar-item" id="room-code">
                Room Code: <span>{gameData.game_code}</span>
                <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                        src="assets/copy.svg"
                        alt="Copy URL"
                        onClick={copyToClipboard}
                        style={{ cursor: "pointer" }}
                    />
                    {showCopiedMessage && (
                        <div className="copied-message">
                            Copied!
                        </div>
                    )}
                </div>
            </div>

            <div class="sidebar-item" id="room-players">
                Players:
                <ul>
                    {gameData.players.length > 0 ? (
                        gameData.players.map((player) => (
                            <li key={player.player_session_id}>
                                {player.player_name}
                                {gameData.isCreator && player.player_session_id !== gameData.creator_session_id && (
                                    <button
                                        className="kick-btn"
                                        onClick={() => handleKickPlayer(player.player_session_id)}
                                    >
                                        Kick
                                    </button>
                                )}
                            </li>
                        ))
                    ) : (
                        <p>No players in the room.</p>
                    )}
                </ul>
            </div>

            {gameData.isCreator && (
                <div class="sidebar-item">
                    <button
                        onClick={handleStartGame}
                        disabled={!canAssignRoles}
                        className="start-game-btn"
                    >
                        {startButtonLabel}
                    </button>
                </div>
            )}


            <div class="sidebar-item" id="room-roles">
                <button
                    onClick={toggleRoleVisibility}
                    disabled={isButtonDisabled || roleButtonLabel === "Your fate has been determined"}
                    className={`toggle-role-btn ${roleButtonClass}`}
                >
                    {roleButtonLabel}
                </button>

                <div>
                    {gameData.players.map((player) =>
                        player.player_session_id === gameData.sessionId ? (
                            <div key={player.player_session_id} className="player-role">
                                {showRole && player.role ? (
                                    player.role === "Spy" ? (
                                        <div>
                                            <div id="role" className="role">
                                                <span className="label">Your role:</span> You are the Spy!
                                                <img
                                                    src="assets/spy.svg"
                                                    alt="Spy Icon"
                                                    className="spy-icon"
                                                />
                                            </div>
                                            <div id="location" className="location">
                                                <span className="label">Your location:</span> No location for you!
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div id="location" className="location">
                                                <span className="label">Your location:</span> {player.location?.name}
                                            </div>
                                            <div id="role" className="role">
                                                <span className="label">Your role:</span> {player.role}
                                            </div>
                                        </div>
                                    )
                                ) : null}
                            </div>
                        ) : null
                    )}
                </div>

            </div>
        </div>
    );
};

export default GameSidebar;
