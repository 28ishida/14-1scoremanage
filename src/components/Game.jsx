import { useEffect, useState } from "react";
import { db } from "../firebase";

import {
    collection,
    doc,
    onSnapshot,
    updateDoc,
    addDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    writeBatch,
    runTransaction,
} from "firebase/firestore";

function Game({ matchId }) {

    const [match, setMatch] = useState(null);
    const [players, setPlayers] = useState([]);
    const [score, setScore] = useState("");
    const [shots, setShots] = useState([]);

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

    useEffect(() => {
        const unsubscribe = onSnapshot(
            query(
                collection(db, "shots"),
                where("matchId", "==", matchId),
                orderBy("shotNo")
            ),
            (snapshot) => {
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setShots(list);
            }
        );
        return unsubscribe;
    }, [matchId]);

    const player1 =
        players.find(p => p.id === match?.player1Id);

    const player2 =
        players.find(p => p.id === match?.player2Id);

    const currentPlayer =
        players.find(p => p.id === match?.currentPlayerId);

    // 次のMatch状態を作成する
    function createNextMatch(match, inputScore) {
        const newPlayer1Score =
            match.currentPlayerId === match.player1Id
                ? match.player1Score + inputScore
                : match.player1Score;
        const newPlayer2Score =
            match.currentPlayerId === match.player2Id
                ? match.player2Score + inputScore
                : match.player2Score;
        const newCurrentPlayerId =
            match.currentPlayerId === match.player1Id
                ? match.player2Id
                : match.player1Id;
        let newInning = match.inning;
        if (newCurrentPlayerId === match.breakPlayerId) {
            newInning++;
        }
        return {
            player1Score: newPlayer1Score,
            player2Score: newPlayer2Score,
            currentPlayerId: newCurrentPlayerId,
            inning: newInning
        };
    }

    // 勝敗判定    
    function judgeWinner(currentMatch , nextMatch )
    {
        const player1Win =
            nextMatch.player1Score >= currentMatch.player1WinningScore;
        const player2Win =
            nextMatch.player2Score >= currentMatch.player2WinningScore;
        const draw =
            nextMatch.inning > currentMatch.maxInning &&
            !player1Win &&
            !player2Win;

        if (player1Win) {
            return {
                status: "win",
                winnerId: currentMatch.player1Id
            };
        }
        if (player2Win) {
            return {
                status: "win",
                winnerId: currentMatch.player2Id
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

        const matchRef = doc(db, "matches", match.id);
        const point = Number(score);

        // firestoreへ保存
        await runTransaction(db, async (transaction) => {
            const matchSnapshot = await transaction.get(matchRef);

            if (!matchSnapshot.exists()) {
                throw new Error("Matchが存在しません");
            }

            const currentMatch = {
                id: matchSnapshot.id,
                ...matchSnapshot.data()
            };
            
            // 次のMatch状態を作成
            const nextMatch = createNextMatch(currentMatch, point);
            
            //console.log(newPlayer1Score);
            //console.log(newPlayer2Score);
            const newShotNo = currentMatch.lastShotNo + 1;

            // 勝利判定
            const winner = judgeWinner(
                currentMatch,
                nextMatch
            );

            // Shotを作成
            const shotRef = doc(collection(db, "shots"));
            transaction.set(shotRef, {
                matchId: currentMatch.id,
                shotNo: newShotNo,
                playerId: currentMatch.currentPlayerId,
                inning: currentMatch.inning,
                score: point,
                createdAt: serverTimestamp()
            });
            transaction.update(matchRef, {
                ...nextMatch,
                status: winner.status,
                winnerId: winner.winnerId,
                lastShotNo: newShotNo,
            });
        });
        setScore("");
    }

    return (
        <div>
            <h2>Match</h2>
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
                    current score
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
                    Register Score
                </button>
            </div>

            {
                match?.status === "win" && (
                    <h2 style={{ color: "red" }}>
                        🏆 Winner:
                        {
                            players.find(p => p.id === match.winnerId)?.name
                        }
                    </h2>
                )
            }

            {
                match?.status === "draw" && (
                    <h2 style={{ color: "blue" }}>
                        draw
                    </h2>
                )
            }

            <div style={{ marginTop: "20px" }}>
                Shot数 : {shots.length}
            </div>

            <div style={{ marginTop: "20px" }}>
                <h3>Shot History</h3>
                {
                    shots.map((shot) => {
                        const player =
                            players.find(p => p.id === shot.playerId);
                        return (
                            <div key={shot.id}>
                                #{shot.shotNo}
                                {" "}
                                {player?.name}
                                {" "}
                                +{shot.score}
                                {" "}
                                (Inning {shot.inning})
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );
}

export default Game;