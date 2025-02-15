import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import JoinGamePopup from "./JoinGamePopup";

const HomePage = () => {
    const [playerName, setPlayerName] = useState("");
    const [isNameValid, setIsNameValid] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState("");
    const [showJoinPopup, setShowJoinPopup] = useState(false);
    const navigate = useNavigate();

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

    const handleCreateGame = async () => {
        if (isNameValid) {
            try {
                const response = await fetch("/api/create-game", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playerName }),
                });

                const data = await response.json();

                if (data.gameCode) {
                    localStorage.setItem("spyx_name", playerName);

                    navigate(`/spyx/${data.gameCode}`);

                    socket.emit("joinRoom", {
                        gameCode: data.gameCode,
                        playerName: data.playerName,
                        sessionId: data.sessionId,
                    });
                } else {
                    setFeedbackMessage("Error creating the game.");
                }
            } catch (error) {
                console.error("Error creating game:", error);
                setFeedbackMessage("Failed to create the game. Please try again.");
            }
        }
    };

    const handleJoinGame = () => {
        if (isNameValid) setShowJoinPopup(true);
    };

    return (
        <div className="join-container">
            <div className="join-wrap">
                <h1>Welcome to SpyX</h1>
                <p>Please enter your name:</p>
                <input
                    type="text"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={handleInputChange}
                />
                <div className="buttons-container">
                    <button onClick={handleCreateGame} disabled={!isNameValid}>
                        Create Game
                    </button>
                    <button onClick={handleJoinGame} disabled={!isNameValid}>
                        Join Game
                    </button>
                </div>
                <div id="feedback" style={{ color: "red" }}>
                    {feedbackMessage}
                </div>
                {showJoinPopup && (
                    <JoinGamePopup
                        playerName={playerName}
                        onConfirm={(roomCode) => console.log("Joining room:", roomCode)}
                        onCancel={() => setShowJoinPopup(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default HomePage;