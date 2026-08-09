import { useEffect, useState } from "react";
import {db} from "../firebase";

import {
    collection,
    onSnapshot,
    addDoc,
    serverTimestamp
} from "firebase/firestore";

function MatchStart({ onStart }) {

    const [players, setPlayers] = useState([]);
    const [player1, setPlayer1] = useState("");
    const [player2, setPlayer2] = useState("");
    const [breakPlayer, setBreakPlayer] = useState("player1");

    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, "players"),
            (snapshot) => {
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setPlayers(list);
            }
        );
        return unsubscribe;
    }, []);

    // デバッグ用
    useEffect(() => {
        if (players.length > 0 && !player1) {
            setPlayer1(players[0].id);
        }
    }, [players, player1]);

    // デバッグ用
    useEffect(() => {
        if (players.length > 1 && !player2) {
            setPlayer2(players[1].id);
        }
    }, [players, player2]);

    async function startMatch() {

        if (player1 === "") {
            alert("Please select Player1");
            return;
        }

        if (player2 === "") {
            alert("Please select Player2");
            return;
        }

        if (player1 === player2) {
            alert("You cannot select the same player");
            return;
        }

        const selectedPlayer1 =
            players.find(p => p.id === player1);

        const selectedPlayer2 =
            players.find(p => p.id === player2);

        const breakPlayerId =
            breakPlayer === "player1"
                ? player1
                : player2;
    
        const docRef = await addDoc(collection(db, "matches"), {

            player1Id: player1,
            player1Name : selectedPlayer1.name,
            player2Id: player2,
            player2Name : selectedPlayer2.name,

            player1WinningScore: selectedPlayer1.winningScore,
            player2WinningScore: selectedPlayer2.winningScore,
            player1Score: 0,
            player2Score: 0,
            breakPlayerId: breakPlayerId,
            currentPlayerId: breakPlayerId,
            inning: 1,
            remainingBalls: 15,
            runningScore: 0,
            status: "playing",
            winnerId: null,
            maxInning: 15,
            createdAt: serverTimestamp(),
            lastTurnNo : 0,
        });

        onStart(docRef.id);
        //alert("Match started");
    }
    
    return (

        <div>
            <label>Player1</label>
            <br />
            <select
                value={player1}
                onChange={(e) => setPlayer1(e.target.value)}
            >
                <option value="">Please select</option>
                {
                    players.map(player => (
                        <option
                            key={player.id}
                            value={player.id}
                        >
                            {player.name}
                        </option>
                    ))
                }
            </select>
            <br />
            <label>Player2</label>
            <br />
            <select
                value={player2}
                onChange={(e) => setPlayer2(e.target.value)}
            >
                <option value="">Please select</option>
                {
                    players.map(player => (
                        <option
                            key={player.id}
                            value={player.id}
                        >
                            {player.name}
                        </option>
                    ))
                }
            </select>

            <div style={{ marginTop: "20px" }}>
                <h3>w-Score</h3>
                <div>
                    Player1 :
                    {
                        players.find(p => p.id === player1)?.winningScore ?? "-"
                    }
                </div>
                <div>
                    Player2 :
                    {
                        players.find(p => p.id === player2)?.winningScore ?? "-"
                    }
                </div>
            </div>
            <div style={{ marginTop: "20px" }}>

                <h3>Break Player</h3>
                <label>
                    <input
                        type="radio"
                        value="player1"
                        checked={breakPlayer === "player1"}
                        onChange={(e) => setBreakPlayer(e.target.value)}
                    />
                    Player1
                </label>
                <br />
                <label>
                    <input
                        type="radio"
                        value="player2"
                        checked={breakPlayer === "player2"}
                        onChange={(e) => setBreakPlayer(e.target.value)}
                    />
                    Player2
                </label>
            </div>            
            <div style={{ marginTop: "20px" }}>
                <button onClick={startMatch}>
                    Start Match
                </button>
            </div>
        </div>
    );
}

export default MatchStart;