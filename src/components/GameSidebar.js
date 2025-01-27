import React, { useEffect, useState } from "react";
import socket from "../socket";

const GameSidebar = ({ gameData, setGameData, locations }) => {
    const [waitingMessage, setWaitingMessage] = useState("Waiting for your fate...");
    const [showRole, setShowRole] = useState(false);
    const [isButtonDisabled, setIsButtonDisabled] = useState(true);
    const [buttonLabel, setButtonLabel] = useState("Start Game");
    const [messageClass, setMessageClass] = useState("");
    const [buttonClass, setButtonClass] = useState("");

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
            .then(() => alert("Room URL copied to clipboard!"))
            .catch((err) => console.error("Error copying text to clipboard", err));
    };

    const handleStartGame = () => {
        socket.emit("assignRoles", {
            gameCode: gameData.game_code,
            locations: locations,
        });

        setButtonLabel("Restart Game");

        socket.emit("startGameFeedback", {
            waitingMessage: "Your fate has been determined...",
            messageClass: "role-assigned",
        });

        setTimeout(() => {
            setMessageClass("");
            setWaitingMessage("");
        }, 5000);
    };


    useEffect(() => {
        // Listen for role assignment updates
        socket.on("roleAssigned", ({ updatedPlayers }) => {
            setGameData((prevGameData) => ({
                ...prevGameData,
                players: updatedPlayers,
            }));

            setIsButtonDisabled(false);
        });

        socket.on("startGameFeedback", ({ waitingMessage, messageClass }) => {
            setWaitingMessage(waitingMessage);
            setMessageClass(messageClass);

            setButtonClass("fade-effect");

            setTimeout(() => {
                setMessageClass("");
                setWaitingMessage("");
                setButtonClass("");
            }, 3000);
        });

        return () => {
            socket.off("roleAssigned");
            socket.off("startGameFeedback");
        };
    }, [setGameData]);



    const toggleRoleVisibility = () => {
        setShowRole((prev) => !prev);
    };

    const canAssignRoles = gameData.players.length >= 2;

    return (
        <div className="sidebar">
            <div id="room-code">
                Room Code: <span>{gameData.game_code}</span>
                <img src="assets/copy.svg" alt="Copy URL" onClick={copyToClipboard} />
            </div>

            <div id="room-players">
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
                <div>
                    <button
                        onClick={handleStartGame}
                        disabled={!canAssignRoles}
                        className="start-game-btn"
                    >
                        {buttonLabel}
                    </button>
                </div>
            )}


            <div id="room-roles">
                <button
                    onClick={toggleRoleVisibility}
                    disabled={isButtonDisabled}
                    className={`toggle-role-btn ${buttonClass}`}
                >
                    {showRole ? "Hide Role" : "Show Role"}
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
                                                <span className="label">Your location:</span> {player.location}
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


                {waitingMessage && (
                    <div className={`role-assignment-message ${messageClass}`}>
                        {waitingMessage}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameSidebar;
