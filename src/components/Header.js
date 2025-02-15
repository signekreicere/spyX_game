import React, { useState, useEffect } from "react";
import SunImage from "../assets/sun.webp";
import MoonImage from "../assets/moon.webp";
import SpyImage from "../assets/spy.webp";
import TableImage from "../assets/table.webp";
import DiscordImage from "../assets/discord.webp";
import RulesImage from "../assets/rules.webp";
import { useLocation } from "react-router-dom";

const Header = ({ onDarkModeToggle }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const location = useLocation();

    // Initialize dark mode from localStorage
    useEffect(() => {
        const darkModeValue = localStorage.getItem("dark_mode");
        const initialMode = darkModeValue === "1";
        setIsDarkMode(initialMode);
        if (onDarkModeToggle) onDarkModeToggle(initialMode);
    }, [onDarkModeToggle]);

    // Handle dark mode toggle
    const toggleDarkMode = () => {
        const sunElement = document.getElementById("sun");
        const moonElement = document.getElementById("moon");

        if (isDarkMode) {
            sunElement.classList.remove("darkmode-btn-out");
            sunElement.classList.add("darkmode-btn-in");

            moonElement.classList.remove("darkmode-btn-in");
            moonElement.classList.add("darkmode-btn-out");
        } else {
            moonElement.classList.remove("darkmode-btn-out");
            moonElement.classList.add("darkmode-btn-in");

            sunElement.classList.remove("darkmode-btn-in");
            sunElement.classList.add("darkmode-btn-out");
        }

        // Toggle and save the new mode
        const newMode = !isDarkMode;
        localStorage.setItem("dark_mode", newMode ? "1" : "0");
        setIsDarkMode(newMode);
        if (onDarkModeToggle) onDarkModeToggle(newMode);
    };

    return (
        <header className="App-header">
            <div className="header-menu">
                <div className="header-left">
                    <a href="/" className="header-link">
                        <img
                            src={TableImage}
                            alt="Table Trouble Logo"
                            className="header-image"
                        />
                    </a>
                </div>

                <div className="header-center">
                    <a href="https://discord.gg/XqDGzgxP" className="header-link" target="_blank" rel="noopener noreferrer">
                        <img
                            src={DiscordImage}
                            alt="Discord Logo"
                            className="header-image"
                        />
                    </a>
                </div>

                <div className="header-center">
                    <a href="/spyx/" className="header-link">
                        <img
                            src={SpyImage}
                            alt="Spyx Logo"
                            className="header-image"
                        />
                    </a>
                </div>

                <div className="header-center">
                    <a
                        href={location.pathname === "/spyx/rules" ? "#" : "/spyx/rules"}
                        className="header-link"
                    >
                        <img
                            src={RulesImage}
                            alt="Rules Logo"
                            className="header-image"
                        />
                    </a>
                </div>

                <div className="header-right">
                    <img
                        src={SunImage}
                        alt="Sun (Light Mode)"
                        className={`darkmode-btn ${isDarkMode ? "darkmode-btn-in" : "darkmode-btn-out"}`}
                        id="sun"
                        onClick={toggleDarkMode}
                    />
                    <img
                        src={MoonImage}
                        alt="Moon (Dark Mode)"
                        className={`darkmode-btn ${isDarkMode ? "darkmode-btn-out" : "darkmode-btn-in"}`}
                        id="moon"
                        onClick={toggleDarkMode}
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;
