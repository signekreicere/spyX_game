import React, { useState, useEffect } from "react";
import socket from "../socket";

const NameInputPopup = ({ gameCode, playerName, setPlayerName, handleJoinGame }) => {
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [isNameValid, setIsNameValid] = useState(false);

    useEffect(() => {
        const storedName = localStorage.getItem("spyx_name");
        if (storedName) {
            setPlayerName(storedName);
            validateName(storedName);
        }
    }, []);

    const validateName = (name) => {
        const lengthIsValid = name.length >= 3 && name.length <= 15;
        const noSpecialChars = /^[a-zA-Z0-9 ]*$/.test(name);
        const noLeadingSpace = !name.startsWith(" ");

        if (!lengthIsValid) {
            setIsNameValid(false);
            setFeedbackMessage("Name must be between 3 and 15 characters.");
        } else if (!noSpecialChars) {
            setIsNameValid(false);
            setFeedbackMessage("Name must only contain letters, numbers, and spaces.");
        } else if (!noLeadingSpace) {
            setIsNameValid(false);
            setFeedbackMessage("Name cannot start with a space.");
        } else {
            setIsNameValid(true);
            setFeedbackMessage("");
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setPlayerName(newValue);
        validateName(newValue);
    };

    const handlePopupJoin = async () => {
        if (isNameValid) {
            try {
                const response = await fetch("/api/join-game", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playerName, gameCode }),
                });

                const data = await response.json();

                if (data.error) {
                    setFeedbackMessage(data.error);
                } else {
                    console.log("Player joined the game:", data);
                    handleJoinGame.setGameData(data);
                    handleJoinGame.setShowPopup(false);

                    const player = data.players.find(player => player.player_session_id === data.sessionId);
                    const playerName = player ? player.player_name : '';

                    localStorage.setItem("spyx_name", playerName);

                    socket.emit("joinRoom", {
                        gameCode: data.game_code,
                        playerName: playerName,
                        sessionId: data.sessionId
                    });
                }
            } catch (error) {
                console.error("Error joining the game:", error);
                setFeedbackMessage("Failed to join the game. Please try again.");
            }
        }
    };

    return (
        <div className="popup-overlay">
            <div className="popup">
                <h2>Join Game</h2>
                <input
                    type="text"
                    placeholder="Player Name"
                    value={playerName}
                    onChange={handleInputChange}
                />
                <div className="popup-buttons">
                    <button onClick={handlePopupJoin} disabled={!isNameValid}>
                        Join Game
                    </button>
                </div>
                {feedbackMessage && (
                    <div id="feedback" style={{ color: "red" }}>
                        {feedbackMessage}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NameInputPopup;