var DiscHoverHFU;
(function (DiscHoverHFU) {
    let GameState;
    (function (GameState) {
        GameState[GameState["Started"] = 0] = "Started";
        GameState[GameState["Running"] = 1] = "Running";
        GameState[GameState["TransitionToMenu"] = 2] = "TransitionToMenu";
        GameState[GameState["TransitionToGame"] = 3] = "TransitionToGame";
        GameState[GameState["Paused"] = 4] = "Paused";
        GameState[GameState["Won"] = 5] = "Won";
    })(GameState = DiscHoverHFU.GameState || (DiscHoverHFU.GameState = {}));
})(DiscHoverHFU || (DiscHoverHFU = {}));
//# sourceMappingURL=GameState.js.map