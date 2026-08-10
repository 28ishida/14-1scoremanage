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
    const [remainingBalls, setRemainingBalls] = useState("15");
    const [turns, setTurns] = useState([]);
    const [isSafty, setIsSafty] = useState(false);
    const [isFoul, setIsFoul] = useState(false);
    const [continusFoulCntP1, setContinusFoulCntP1] = useState(0);
    const [continusFoulCntP2, setContinusFoulCntP2] = useState(0);

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
            collection(db, "matches", matchId, "turns"),
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

            transaction.update(matchRef, {
                remainingBalls: 15,
                runningScore:
                    currentRunningScore + (currentRemainingBalls - 1)
            });
        });

        setRemainingBalls(15);
    }

    // 連続ファウルチェック
    function checkContinusFaul(currentPlayerId, isFoul) {
        if (currentPlayerId === match?.player1Id) {
            if (isFoul) {
                const newContinusFoulCntP1 = continusFoulCntP1 + 1;
                setContinusFoulCntP1(newContinusFoulCntP1);
                if (newContinusFoulCntP1 >= 3) {
                    return true;
                }
            } else {
                setContinusFoulCntP1(0);
            }
        } else if (currentPlayerId === match?.player2Id) {
            if (isFoul) {
                const newContinusFoulCntP2 = continusFoulCntP2 + 1;
                setContinusFoulCntP2(newContinusFoulCntP2);
                if (newContinusFoulCntP2 >= 3) {
                    return true;
                }
            } else {
                setContinusFoulCntP2(0);
            }
        }
        return false;
    }

    // ファウル計算を含む最終スコア計算
    function createFinalTurnScore(currentMatch, turnNum, point) {

        point -= 1;
        if (turnNum >= 4) {
            const oneTimeAgoTurn = turns.find(turn => turn.turnNo === turnNum - 1);
            const twoTimesAgoTurn = turns.find(turn => turn.turnNo === turnNum - 3);

            if (oneTimeAgoTurn.isFoul && twoTimesAgoTurn.isFoul) {
                point -= 14;    // 追加で-14
            }
        }
        return point;
    }

    // スコア登録
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
            const newTurnNo = currentMatch.lastTurnNo + 1;
            
            // 連続ファールチェック
            const isContinusFoul = checkContinusFaul( currentMatch.currentPlayerId, isFoul );

            // Turnを作成
            const turnRef = doc(collection(db, "matches", currentMatch.id, "turns"));
            transaction.set(turnRef, {
                matchId: currentMatch.id,
                turnNo: currentMatch.lastTurnNo + 1,
                playerId: currentMatch.currentPlayerId,
                inning: currentMatch.inning,
                score: point,
                remainingBalls: nextRemainingBalls,
                createdAt: serverTimestamp(),
                isSafty: isSafty,
                isFoul: isFoul,
                runningScore: currentRunningScore,
                isContinusFoul: isContinusFoul,
            });

            // 次のMatch状態を作成
            const turnPoint = isFoul ? isContinusFoul ? point - 15 : point - 1 : point;
            const nextState = createNextState(
                currentState, 
                turnPoint
            );

            // 勝利判定
            const winner = judgeWinner(
                currentMatch,
                nextState
            );

            // Matchを更新
            transaction.update(matchRef, {
                ...nextState,
                remainingBalls: nextRemainingBalls,
                status: winner.status,
                winnerId: winner.winnerId,
                lastTurnNo: currentMatch.lastTurnNo + 1, newTurnNo,
            });
        });
        
        setIsSafty(false);
        setIsFoul(false);
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
            collection(db, "matches", matchId, "turns"),
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
            state = createNextState(
                state, 
                turn.isFoul ? turn.isContinusFoul ? turn.score - 15 : turn.score - 1 : turn.score
            );

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
                Safety :
                <input
                    type="checkbox"
                    checked={isSafty}
                    onChange={(e) => setIsSafty(e.target.checked)}
                />
                </div>
                Foul:
                <input
                    type="checkbox"
                    checked={isFoul}
                    onChange={(e) => setIsFoul(e.target.checked)}
                />

                <div>
                    Remaining Balls : {match?.remainingBalls}
                </div>

                <div>
                    Running Score : {match?.runningScore}
                </div>
                <button onClick={() => rebuildMatch(match.id)}>
                    Rebuild Test
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
                <h3>SCORE</h3>
                {
                    <table style={{
                        width: "100%",
                        maxwidth: "200px",
                        borderCollapse: "collapse"
                    }}>
                        <thead>
                            <tr>
                                <th style={{ border: "1px solid #ccc" }}>No</th>
                                <th style={{ border: "1px solid #ccc" }}>Player</th>
                                <th style={{ border: "1px solid #ccc" }}>Score</th>
                                <th style={{ border: "1px solid #ccc" }}>Foul</th>
                                <th style={{ border: "1px solid #ccc" }}>Safty</th>
                                <th style={{ border: "1px solid #ccc" }}>RS</th>
                                <th style={{ border: "1px solid #ccc" }}>tb</th>
                            </tr>
                        </thead>

                        <tbody>
                            {turns.map((turn) => (
                                <tr key={turn.id}>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.turnNo}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.playerId === match.player1Id
                                            ? match.player1Name
                                            : match.player2Name}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.score}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.isFoul ? turn.isContinusFoul ? "-15" : "-1" : ""}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.isSafty ? "S" : ""}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.runningScore == 0 ? "" : "+" + turn.runningScore}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", textAlign: "center" }}>
                                        {turn.remainingBalls - 15}
                                    </td>
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