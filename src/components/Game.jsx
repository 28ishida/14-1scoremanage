import { useEffect, useState } from "react";
import { db } from "../firebase";

import {
    collection,
    doc,
    onSnapshot,
    updateDoc,
} from "firebase/firestore";

function Game({ matchId }) {

    const [match, setMatch] = useState(null);
    const [players, setPlayers] = useState([]);
    const [score, setScore] = useState("");

    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, "matches", matchId),
            (snapshot) => {
                if (snapshot.exists()) {
                    setMatch({
                        id: snapshot.id,
                        ...snapshot.data()
                    });
                }
            }
        );
        return unsubscribe;
    }, [matchId]);

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

    const player1 =
        players.find(p => p.id === match?.player1Id);

    const player2 =
        players.find(p => p.id === match?.player2Id);

    const currentPlayer =
        players.find(p => p.id === match?.currentPlayerId);

    // 勝敗判定    
    function judgeWinner(
        match,
        newPlayer1Score,
        newPlayer2Score,
        newInning
    ) {
        const player1Win =
            newPlayer1Score >= match.player1WinningScore;
        const player2Win =
            newPlayer2Score >= match.player2WinningScore;
        const draw =
            newInning > match.maxInning &&
            !player1Win &&
            !player2Win;

        if (player1Win) {
            return {
                status: "win",
                winnerId: match.player1Id
            };
        }
        if (player2Win) {
            return {
                status: "win",
                winnerId: match.player2Id
            };
        }

        if (draw) {
            return {
                status: "draw",
                winnerId: null
            };
        }

        return {
            status: "playing",
            winnerId: null
        };
    }

    async function registerScore() {
        
        // プレイ中じゃない試合は即終了
        if (match.status !== "playing") { return; }

        const point = Number(score);

        let newPlayer1Score = match.player1Score;
        let newPlayer2Score = match.player2Score;

        // スコア更新
        if (match.currentPlayerId === match.player1Id) {
            newPlayer1Score += point;
        } else {
            newPlayer2Score += point;
        }
        let newCurrentPlayerId;
        let newInning = match.inning;

        // イニング更新
        if (match.currentPlayerId === match.player1Id) {
            newCurrentPlayerId = match.player2Id;
        } else {
            newCurrentPlayerId = match.player1Id;
        }
        if (newCurrentPlayerId === match.player1Id) {
            newInning++;
        }

        // 勝利判定
        const result = judgeWinner(
            match,
            newPlayer1Score,
            newPlayer2Score,
            newInning
        );
        const newStatus = result.status;
        const newWinnerId = result.winnerId;

        console.log(newPlayer1Score);
        console.log(newPlayer2Score);

        // firestoreへ保存
        await updateDoc(
            doc(db, "matches", match.id),
            {
                player1Score: newPlayer1Score,
                player2Score: newPlayer2Score,
                currentPlayerId: newCurrentPlayerId,
                inning: newInning,
                status: newStatus,
                winnerId: newWinnerId,
            }
        );
        setScore("");
    }

    return (
        <div>
            <h2>ゲーム画面</h2>
            <div style={{ marginBottom: "20px" }}>
                <div>
                    {player1?.name}
                    {"　vs　"}
                    {player2?.name}
                </div>
                <div>
                    {match?.player1Score}
                    {" / "}
                    {match?.player1WinningScore}
                    {"　　"}
                    {match?.player2Score}
                    {" / "}
                    {match?.player2WinningScore}
                </div>
            </div>

            <div>
                Match ID
            </div>

            <div>
                {match?.id}
            </div>

            <div style={{ marginTop: "20px" }}>
                Status :
                {match?.status}
            </div>

            <div>
                Current :
                {currentPlayer?.name}
            </div>

            <div>
                Inning :
                {match?.inning}
            </div>

            <div style={{ marginTop: "30px" }}>
                <div>
                    今回の得点
                </div>
                <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    disabled={match?.status !== "playing"}
                />
            </div>

            <div style={{ marginTop: "20px" }}>
                <button
                    onClick={registerScore}
                    disabled={match?.status !== "playing" }
                >
                    登録
                </button>
            </div>

            {
                match?.status === "win" && (
                    <h2 style={{ color: "red" }}>
                        🏆 勝者：
                        {
                            players.find(p => p.id === match.winnerId)?.name
                        }
                    </h2>
                )
            }

            {
                match?.status === "draw" && (
                    <h2 style={{ color: "blue" }}>
                        引き分け
                    </h2>
                )
            }      
        </div>
    );
}

export default Game;