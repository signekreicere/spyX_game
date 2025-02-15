import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import Header from "./components/Header";
import HomePage from "./components/HomePage";
import GameRoom from "./components/GameRoom";
import Rules from "./components/Rules";

function App() {
    const [isDarkMode, setIsDarkMode] = useState(false);

    const handleDarkModeToggle = (darkMode) => {
        setIsDarkMode(darkMode);
    };

    return (
        <Router>
            <div className={`App ${isDarkMode ? "dark-mode" : "light-mode"}`}>
                <Header onDarkModeToggle={handleDarkModeToggle} />
                <main className="App-main">
                    <Routes>
                        <Route path="/spyx/" element={<HomePage />} />
                        <Route path="/spyx/:gameCode" element={<GameRoom />} />
                        <Route path="/spyx/rules" element={<Rules />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
