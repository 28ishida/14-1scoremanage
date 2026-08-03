import { useState } from "react";
import PlayerList from "./components/PlayersList";
import Menu from "./components/Menu";
import MatchStart from "./components/MatchStart";
import MatchList from "./components/MatchList";
import Game from "./components/Game";

function App() {
    const [currentScreen, setCurrentScreen] = useState("menu");
    const [currentMatchId, setCurrentMatchId] = useState(null);

    return (
        <div>

            <h1>React test System</h1>

            <Menu onSelect={setCurrentScreen} />
            {
                currentScreen === "players" && 
                <PlayerList 
                />}
            {
                currentScreen === "match" && (
                    <MatchStart
                        onStart={(matchId) => {
                            setCurrentMatchId(matchId);
                            setCurrentScreen("game");
                        }}
                    />
                )
            }
            {currentScreen === "matches" && 
                <MatchList
                    onOpen = {(matchId) => {
                        setCurrentMatchId(matchId);
                        setCurrentScreen("game");
                    }}
                />}
            {currentScreen === "game" && (
                <Game
                    matchId={currentMatchId}
                />
            )}
        </div>
    );

}

export default App;