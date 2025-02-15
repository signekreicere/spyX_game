import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

const JoinGamePopup = ({ playerName, onCancel }) => {
    const [roomCode, setRoomCode] = useState("");
    const [isCodeValid, setIsCodeValid] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const navigate = useNavigate();

    const validateRoomCode = (code) => {
        const isValid = /^[A-Z0-9]{4}$/.test(code);
        setIsCodeValid(isValid);
        setFeedbackMessage(isValid ? "" : "Room code must be 4 uppercase letters.");
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
        setRoomCode(newValue);
        validateRoomCode(newValue);
    };

    const handleJoinGame = async () => {
        if (!isCodeValid) return;

        try {
            const response = await fetch("/api/join-game", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerName, gameCode: roomCode }),
            });

            const data = await response.json();

            if (data.error) {
                setFeedbackMessage(data.error);
            } else {
                localStorage.setItem("spyx_name", playerName);
                navigate(`/spyx/${roomCode}`);
                socket.emit("joinRoom", {
                    gameCode: data.game_code,
                    playerName,
                    sessionId: data.sessionId,
                });
            }
        } catch (error) {
            console.error("Error joining game:", error);
            setFeedbackMessage("Failed to join the game. Please try again.");
        }
    };

    return (
        <div className="popup-overlay">
            <div className="popup">
                <h2>Enter Room Code</h2>
                <input
                    type="text"
                    placeholder="Enter 4-letter code"
                    value={roomCode}
                    onChange={handleInputChange}
                    maxLength={4}
                />
                <div className="popup-buttons">
                    <button onClick={handleJoinGame} disabled={!isCodeValid}>
                        Join Game
                    </button>
                    <button onClick={onCancel}>Cancel</button>
                </div>
                {feedbackMessage && <div className="feedback" style={{ color: "red" }}>{feedbackMessage}</div>}
            </div>
        </div>
    );
};

export default JoinGamePopup;