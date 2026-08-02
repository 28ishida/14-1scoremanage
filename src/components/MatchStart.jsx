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

    async function startMatch() {

        if (player1 === "") {
            alert("Player1を選択してください");
            return;
        }

        if (player2 === "") {
            alert("Player2を選択してください");
            return;
        }

        if (player1 === player2) {
            alert("同じプレイヤーは選択できません");
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
            player2Id: player2,

            player1WinningScore: selectedPlayer1.winningScore,
            player2WinningScore: selectedPlayer2.winningScore,
            player1Score: 0,
            player2Score: 0,
            breakPlayerId: breakPlayerId,
            currentPlayerId: breakPlayerId,
            inning: 1,
            status: "playing",
            winnerId: null,
            maxInning: 15,
            createdAt: serverTimestamp()
        });

        onStart(docRef.id);
        alert("試合を開始しました");
    }
    
    return (

        <div>
            <label>Player1</label>
            <br />
            <select
                value={player1}
                onChange={(e) => setPlayer1(e.target.value)}
            >
                <option value="">選択してください</option>
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
                <option value="">選択してください</option>
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
                <h3>Winning Score</h3>
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

                <h3>先攻</h3>
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
                    試合開始
                </button>
            </div>
        </div>
    );
}

export default MatchStart;