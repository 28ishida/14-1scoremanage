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
    const [remainingBalls, setRemainingBalls] = useState("");
    const [turns, setTurns] = useState([]);
    const [tableSituation, setTableSituation] = useState("");

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
            collection(db, "turns"),
            where("matchId", "==", matchId),
            orderBy("turnNo")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTurns(list);
        });
        return unsubscribe;
    }, [matchId]);

    const player1 =
        players.find(p => p.id === match?.player1Id);

    const player2 =
        players.find(p => p.id === match?.player2Id);

    const currentPlayer =
        players.find(p => p.id === match?.currentPlayerId);

    async function rackBalls() {
        // プレイ中じゃない試合は終了
        if (match.status !== "playing") {
            return;
        }
        const matchRef = doc(db, "matches", match.id);
        await runTransaction(db, async (transaction) => {
            const matchSnapshot = await transaction.get(matchRef);
            if (!matchSnapshot.exists()) {
                throw new Error("Matchが存在しません");
            }
            const currentMatch = {
                id: matchSnapshot.id,
                ...matchSnapshot.data()
            };
            const currentRemainingBalls =
                currentMatch.remainingBalls;

            const currentRunningScore =
                currentMatch.runningScore ?? 0;

            setTableSituation("+");

            transaction.update(matchRef, {
                remainingBalls: 15,
                runningScore:
                    currentRunningScore + (currentRemainingBalls - 1)
            });
        });
    }        

    async function registerTurn() {
        
        // プレイ中じゃない試合は即終了
        if (match.status !== "playing") { return; }

        const matchRef = doc(db, "matches", match.id);
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

            const currentRemainingBalls = currentMatch.remainingBalls;
            const nextRemainingBalls = Number(remainingBalls);
            const currentRunningScore = currentMatch.runningScore;
            const point = currentRunningScore + currentRemainingBalls - nextRemainingBalls;
            const currentState = createCurrentState(currentMatch);

            // 次のMatch状態を作成
            const nextState = createNextState(currentState, point);
            
            const newTurnNo = currentMatch.lastTurnNo + 1;

            // 勝利判定
            const winner = judgeWinner(
                currentMatch,
                nextState
            );

            // Turnを作成
            const shotRef = doc(collection(db, "turns"));
            transaction.set(shotRef, {
                matchId: currentMatch.id,
                turnNo: newTurnNo,
                playerId: currentMatch.currentPlayerId,
                inning: currentMatch.inning,
                score: point,
                remainingBalls: nextRemainingBalls,
                createdAt: serverTimestamp()
            });
            transaction.update(matchRef, {
                ...nextState,
                remainingBalls: nextRemainingBalls,
                status: winner.status,
                winnerId: winner.winnerId,
                lastTurnNo: newTurnNo,
            });
        });
        setRemainingBalls("");
        setTableSituation(remainingBalls-15);
    }

    // undo
    async function undoLastTurn() {
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

        // Turn取得
        const q = query(
            collection(db, "turns"),
            where("matchId", "==", matchId),
            orderBy("turnNo")
        );

        const turnSnapshot = await getDocs(q);

        const turns = turnSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        let state = createInitialState(match);
        for (const turn of turns) {
            state = createNextState(state, turn.score);
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
                    Remaining Ball :
                </div>
                <input
                    type="number"
                    value={remainingBalls}
                    onChange={(e) => setRemainingBalls(e.target.value)}
                    disabled={match?.status !== "playing"}
                />
            </div>

            <div style={{ marginTop: "20px" }}>
                <button
                    onClick={registerTurn}
                    disabled={match?.status !== "playing" }
                >
                    Register Score
                </button>
                <button
                    onClick={rackBalls}
                >
                    Rack
                </button>
                <div>
                    Remaining Balls : {match?.remainingBalls}
                </div>

                <div>
                    Running Score : {match?.runningScore}
                </div>
                <button onClick={() => rebuildMatch(match.id)}>
                    Rebuild Test
                </button>

                <div>
                    <button onClick={undoLastTurn}>
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

            <div style={{ marginTop: "30px" }}>
                <h3>Score Sheet</h3>
                <table border="1" cellPadding="8">
                    <thead>
                        <tr>
                            <th></th>
                            {
                                Array.from(
                                    { length: match?.inning || 0 },
                                    (_, index) => (
                                        <th key={index}>
                                            {index + 1}
                                        </th>
                                    )
                                )
                            }
                        </tr>
                    </thead>

                    <tbody>
                        {/* Player 1 Score */}
                        <tr>
                            <th>
                                {match?.player1Name}
                            </th>

                            {
                                Array.from(
                                    { length: match?.inning || 0 },
                                    (_, index) => {
                                        const inning = index + 1;

                                        const turn = turns.find(
                                            turn =>
                                                turn.playerId === match.player1Id &&
                                                turn.inning === inning
                                        );

                                        return (
                                            <td key={inning}>
                                                {turn?.score ?? ""}
                                            </td>
                                        );
                                    }
                                )
                            }
                        </tr>

                        {/* Player 1 Remain */}
                        <tr>
                            <th>Table situation</th>
                            {
                                Array.from(
                                    { length: match?.inning || 0 },
                                    (_, index) => {
                                        const inning = index + 1;

                                        const turn = turns.find(
                                            turn =>
                                                turn.playerId === match.player1Id &&
                                                turn.inning === inning
                                        );

                                        return (
                                            <td key={inning}>
                                                  {tableSituation}
                                            </td>
                                        );
                                    }
                                )
                            }
                        </tr>
                        {/* Player 2 Score */}
                        <tr>
                            <th>
                                {match?.player2Name}
                            </th>

                            {
                                Array.from(
                                    { length: match?.inning || 0 },
                                    (_, index) => {
                                        const inning = index + 1;

                                        const turn = turns.find(
                                            turn =>
                                                turn.playerId === match.player2Id &&
                                                turn.inning === inning
                                        );

                                        return (
                                            <td key={inning}>
                                                {turn?.score ?? ""}
                                            </td>
                                        );
                                    }
                                )
                            }
                        </tr>

                        {/* Player 2 Remain */}
                        <tr>
                            <th>Table situation</th>

                            {
                                Array.from(
                                    { length: match?.inning || 0 },
                                    (_, index) => {
                                        const inning = index + 1;

                                        const turn = turns.find(
                                            turn =>
                                                turn.playerId === match.player2Id &&
                                                turn.inning === inning
                                        );

                                        return (
                                            <td key={inning}>
                                                {turn?.remainingBalls != null ? `-${15 - turn.remainingBalls}` : ""}
                                            </td>
                                        );
                                    }
                                )
                            }
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

//                                                  {turn?.remainingBalls != null ? `-${15 - turn.remainingBalls}` : ""}

export default Game;