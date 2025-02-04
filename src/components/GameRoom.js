import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import NameInputPopup from "./NameInputPopup";
import GameSidebar from "./GameSidebar";
import socket from "../socket";

const GameRoom = () => {
    const { gameCode } = useParams();
    const [gameData, setGameData] = useState(null);
    const [locations, setLocations] = useState([]);
    const [selectedLocations, setSelectedLocations] = useState({});
    const [loading, setLoading] = useState(true);
    const [showPopup, setShowPopup] = React.useState(false);
    const [playerName, setPlayerName] = React.useState("");

    const handleKickPlayer = async (playerSessionId) => {
        try {
            const response = await fetch("/api/kick-player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerSessionId, gameCode: gameData.game_code }),
            });

            const data = await response.json();

            if (data.success) {

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

    useEffect(() => {
        const fetchGameData = async () => {
            try {
                const response = await fetch(`/api/game/${gameCode}`, { credentials: "include" });
                const data = await response.json();

                if (data.error) {
                    console.error("Error fetching game data:", data.error);
                    if (data.error === "Session ID is required" || data.error === "Session ID is not associated with this game") {
                        setShowPopup(true);
                    }
                } else {
                    setGameData(data);
                }
            } catch (error) {
                console.error("Error fetching game data:", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchLocations = async () => {
            try {
                const response = await fetch("/api/locations");
                const data = await response.json();
                setLocations(data);
            } catch (error) {
                console.error("Error fetching locations:", error);
            }
        };

        fetchGameData();
        fetchLocations();

    }, [gameCode]);

    useEffect(() => {
        socket.on("updateGameData", (gameData) => {
            // Merging existing game data with the new players array
            setGameData((prevGameData) => ({
                ...prevGameData,
                players: gameData.players,
            }));
        });

        socket.on("kickedFromRoom", () => {
            alert("You were kicked from this game room");

            const BASE_URL = process.env.REACT_APP_BASE_URL || "https://tabletrouble.com/spyx/";

            setTimeout(() => {
                window.location.href = BASE_URL;
            }, 2000);
        });

        // Cleanup on unmount
        return () => {
            socket.off("updateGameData");
            socket.off("kickedFromRoom");
        };
    }, []);


    // Show loading state while fetching data or no game data
    if (loading || (!gameData && !showPopup)) {
        return <p>Loading game data...</p>;
    }

    if (showPopup) {
        return <NameInputPopup
            playerName={playerName}
            setPlayerName={setPlayerName}
            gameCode={gameCode}
            handleJoinGame={{
                gameCode,
                setGameData,
                setShowPopup,
            }}
        />;
    }

    if (!gameData || !gameData.players) {
        return <p>Error: Unable to fetch game data. Please try again later.</p>;
    }

    return (
        <div className="game-container">
            <div className="game-main">
                <div className="location-wrapper">
                    <div className="locations-grid">
                        {locations.map((location) => (
                            <div
                                key={location.id}
                                id={`spyx-location-${location.id}`}
                                className={`location-card 
                                    ${selectedLocations[location.id] ? 'selected' : ''} 
                                    ${document.getElementById(`spyx-location-${location.id}`)?.classList.contains('current') ? 'current' : ''}
                                `}
                                onClick={(e) => {
                                    const hasCurrentClass = e.currentTarget.classList.contains('current');
                                    const isSelected = selectedLocations[location.id];

                                    setSelectedLocations((prev) => {
                                        const newState = {
                                            ...prev,
                                            [location.id]: !prev[location.id],
                                        };
                                        return newState;
                                    });
                                }}
                            >

                            <img
                                    src={`assets/locations/${location.location_picture}`}
                                    alt={location.name}
                                    className="location-image"
                                />
                                <h3 className="location-name">
                                    {location.name}
                                </h3>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <GameSidebar gameData={gameData} handleKickPlayer={handleKickPlayer} locations={locations}/>
        </div>
    );


};

export default GameRoom;
