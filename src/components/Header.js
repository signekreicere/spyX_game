import React, { useState, useEffect } from "react";
import SunImage from "../assets/sun.webp";
import MoonImage from "../assets/moon.webp";
import SpyImage from "../assets/spy.webp";
import TableImage from "../assets/table.webp";

const Header = ({ onDarkModeToggle }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

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
        if (onDarkModeToggle) onDarkModeToggle(newMode); // Notify parent
    };

    return (
        <header className="App-header">
            <div className="header-left">
                <a href="https://tabletrouble.com" className="header-link">
                    <img
                        src={TableImage}
                        alt="Logo"
                        className="header-image"
                    />
                    TableTrouble
                </a>
            </div>

            <div className="header-center">
                <a href="https://tabletrouble.com/spyx/" className="header-link">
                    <img
                        src={SpyImage}
                        alt="Logo"
                        className="header-image"
                    />
                    SpyX
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
        </header>
    );
};

export default Header;
