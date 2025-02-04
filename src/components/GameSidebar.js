import React, { useEffect, useState, useRef } from "react";
import socket from "../socket";

const GameSidebar = ({ gameData, handleKickPlayer, locations }) => {
    const [showCopiedMessage, setShowCopiedMessage] = useState(false);
    const [startButtonLabel, setStartButtonLabel] = useState("Start Game");
    const [playerRole, setPlayerRole] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const isAssigningRolesRef = useRef(false);

    const [roleState, setRoleState] = useState({
        showRole: localStorage.getItem("showRole") === "true",
        buttonDisabled: true,
        buttonClass: "",
        buttonLabel: localStorage.getItem("showRole") === "true" ? "Hide Role" : "Show Role",
    });

    const updateRoleButton = (show, disabled, label, fadeEffect = false) => {
        setRoleState(prev => ({
            ...prev,
            showRole: show,
            buttonDisabled: disabled,
            buttonLabel: label,
            buttonClass: fadeEffect ? "fade-effect" : "",
        }));
    };

    useEffect(() => {
        const fetchPlayerData = async () => {
            try {
                const response = await fetch(`/api/player-info?gameCode=${gameData.game_code}&sessionId=${gameData.sessionId}`);
                const playerData = await response.json();

                if (playerData.role) {
                    setPlayerRole(playerData.role);
                    setPlayerLocation(playerData.location);
                    setStartButtonLabel("Restart Game");

                    if (!isAssigningRolesRef.current && localStorage.getItem("showRole") === "true") {
                        updateRoleButton(true, false, "Hide Role");
                    }
                }
            } catch (error) {
                console.error("Error fetching player role and location:", error);
            }
        };

        if (gameData?.game_code && gameData?.sessionId) {
            fetchPlayerData();
        }

        socket.on("startGameFeedback", (data) => {
            document.querySelectorAll(".location-card").forEach(card => {
                card.classList.remove("current");
                card.classList.remove("selected");
            });

            const currentPlayer = gameData.players.find(
                (player) => player.player_session_id === gameData.sessionId
            );

            if (currentPlayer) {
                setPlayerRole(currentPlayer.role);
                setPlayerLocation(currentPlayer.location);
            }

            isAssigningRolesRef.current = true;
            updateRoleButton(roleState.showRole, true, "Your fate has been determined", true);

            setTimeout(() => {
                isAssigningRolesRef.current = false;
                updateRoleButton(roleState.showRole, false, roleState.showRole ? "Hide Role" : "Show Role");
            }, 3000);
        });

        return () => {
            socket.off("startGameFeedback");
        };
    }, [gameData]);

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

    const canAssignRoles = gameData.players.length >= 2;

    const handleStartGame = () => {
        socket.emit("assignRoles", {
            gameCode: gameData.game_code,
            locations: locations
        });

        setStartButtonLabel("Restart Game");
    };

    const toggleRoleVisibility = () => {
        const newState = !roleState.showRole;
        localStorage.setItem("showRole", newState);
        updateRoleButton(newState, false, newState ? "Hide Role" : "Show Role");
        roleVisibilityFnct();
    };

    const roleVisibilityFnct = () => {
        if (roleState.showRole && playerLocation) {
            const targetLocationElement = document.getElementById(`spyx-location-${playerLocation.id}`);
            if (targetLocationElement) {
                targetLocationElement.classList.add("current");
            }
        }
    };

    return (
        <div className="sidebar">
            <div className="sidebar-item" id="room-code">
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

            <div className="sidebar-item" id="room-players">
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
                <div className="sidebar-item">
                    <button
                        onClick={handleStartGame}
                        disabled={!canAssignRoles}
                        className="start-game-btn"
                    >
                        {startButtonLabel}
                    </button>
                </div>
            )}

            <div className="sidebar-item" id="room-roles">
                <button
                    onClick={toggleRoleVisibility}
                    className={`toggle-role-btn ${roleState.buttonClass}`}
                    disabled={roleState.buttonDisabled}
                >
                    {roleState.buttonLabel}
                </button>
                {roleState.showRole && playerRole && (
                    <div className="player-role">
                        <div id="location" className="location">
                            <span className="label">Your location:</span> {playerLocation ? playerLocation.name : "No location for you!"}
                        </div>
                        <div id="role" className="role">
                            <span className="label">Your role:</span> {playerRole}
                            {playerRole === "Spy" && (
                                <img
                                    src="assets/spy.svg"
                                    alt="Spy Icon"
                                    className="spy-icon"
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameSidebar;
