import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const Rules = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleBack = () => {
        const referrer = document.referrer;
        const currentOrigin = window.location.origin;

        // Check if the user came from within the game (/spyx/{gameCode})
        const cameFromGame = location.state?.fromGameCode || referrer.includes(`${currentOrigin}/spyx/`);

        if (cameFromGame) {
            navigate(referrer.replace(currentOrigin, ""));
        } else {
            if (location.pathname === "/spyx/rules") {
                navigate("/spyx/", { replace: true });
            } else {
                navigate(-1);
            }
        }
    };

    return (
        <div className="rules-container">
            <h1>How to Play SpyX</h1>
            <p>SpyX is a social deduction game inspired by Spyfall.</p>

            <h2>Objective</h2>
            <p>One player is the Spy, while others share a common location and role. The goal is to find the Spy before they figure out the location!</p>

            <h2>Gameplay</h2>
            <ul>
                <li>Each round, players take turns asking each other questions.</li>
                <li>The Spy must blend in without knowing the location.</li>
                <li>After a few minutes, players vote on who they think the Spy is.</li>
            </ul>

            <h2>Winning</h2>
            <p>The Spy wins by guessing the location correctly. Other players win by exposing the Spy.</p>

            <button onClick={handleBack}>Back</button>
        </div>
    );
};

export default Rules;