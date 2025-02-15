import React, { useState } from "react";

const KickPlayerPopup = ({ playerName, onConfirm, onCancel }) => {
    return (
        <div className="popup-overlay">
            <div className="popup">
                <h2>Kick Player</h2>
                <p>Are you sure you want to kick <strong>{playerName}</strong>?</p>
                <div className="popup-buttons">
                    <button onClick={onConfirm} className="confirm-btn">Yeet 'em</button>
                    <button onClick={onCancel} className="cancel-btn">Let 'em stay</button>
                </div>
            </div>
        </div>
    );
};

export default KickPlayerPopup;