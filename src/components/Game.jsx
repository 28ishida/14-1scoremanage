import { useEffect, useState } from "react";
import { db } from "../firebase";
import { createNextState, judgeWinner, createInitialState, createCurrentState } from "../logic/gameLogic";
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
    getDoc,
    getDocs,
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
        if (!matchId) return;
        const q = query(
            collection(db, "shots"),
            where("matchId", "==", matchId),
            orderBy("shotNo")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setShots(list);
        });
        return unsubscribe;
    }, [matchId]);

    const player1 =
        players.find(p => p.id === match?.player1Id);

    const player2 =
        players.find(p => p.id === match?.player2Id);

    const currentPlayer =
        players.find(p => p.id === match?.currentPlayerId);

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

            const currentState = createCurrentState(currentMatch);

            // 次のMatch状態を作成
            const nextState = createNextState(currentState, point);
            
            const newShotNo = currentMatch.lastShotNo + 1;

            // 勝利判定
            const winner = judgeWinner(
                currentMatch,
                nextState
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
                ...nextState,
                status: winner.status,
                winnerId: winner.winnerId,
                lastShotNo: newShotNo,
            });
        });
        setScore("");
    }

    // undo
    async function undoLastShot() {
    }

    // matchを再構築する
    async function rebuildMatch(matchId) {

        // Match取得
        const matchRef = doc(db, "matches", matchId);
        const matchSnapshot = await getDoc(matchRef);

        if (!matchSnapshot.exists()) {
            throw new Error("Matchが存在しません");
        }

        const match = {
            id: matchSnapshot.id,
            ...matchSnapshot.data()
        };

        // Shot取得
        const q = query(
            collection(db, "shots"),
            where("matchId", "==", matchId),
            orderBy("shotNo")
        );

        const shotSnapshot = await getDocs(q);

        const shots = shotSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        let state = createInitialState(match);
        for (const shot of shots) {
            state = createNextState(state, shot.score);
        }

        const winner = judgeWinner(match, state);
        
        await updateDoc(matchRef, {
            player1Score: state.player1Score,
            player2Score: state.player2Score,
            currentPlayerId: state.currentPlayerId,
            inning: state.inning,
            status: winner.status,
            winnerId: winner.winnerId
        });
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
                <button onClick={() => rebuildMatch(match.id)}>
                    Rebuild Test
                </button>

                <div>
                    <button onClick={undoLastShot}>
                        Undo
                    </button>
                </div>
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
                <h3>Shot履歴</h3>
                {
                    <table>
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Player</th>
                                <th>Score</th>
                            </tr>
                        </thead>

                        <tbody>
                            {shots.map((shot) => (
                                <tr key={shot.id}>
                                    <td>{shot.shotNo}</td>
                                    <td>
                                        {shot.playerId === match.player1Id
                                            ? match.player1Name
                                            : match.player2Name}
                                    </td>
                                    <td>{shot.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>            
                }
            </div>
        </div>
    );
}

export default Game;