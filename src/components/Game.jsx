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
    const [turns, setTurns] = useState([]);
    const [isSafty, setIsSafty] = useState(false);
    const [isFoul, setIsFoul] = useState(false);
    const [continusFoulCntP1, setContinusFoulCntP1] = useState(0);
    const [continusFoulCntP2, setContinusFoulCntP2] = useState(0);
    const [tableCondition, setTableCondition] = useState("");       // 表示用

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

    // 表示系で使ってる変数
    const player1 = players.find(p => p.id === match?.player1Id);
    const player2 = players.find(p => p.id === match?.player2Id);
    const currentPlayer = players.find(p => p.id === match?.currentPlayerId);

    // turnを表示文字列に整形する
    function formatTurn(turn) {
        let result = turn.point.toString();

        if (turn.isSafty) {
            result += " S";
        }

        if (turn.isFoul) {
            result += turn.isContinusFoul ? " -15" : " -1";
        }

        return result;
    }

    // ラック跨ぎ
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

            const currentRunningPoint =
                currentMatch.runningPoint ?? 0;

            transaction.update(matchRef, {
                remainingBalls: 15,
                runningPoint: currentRunningPoint + (currentRemainingBalls - 1)
            });

            // テーブル状況更新
            setTableCondition( tableCondition + " +" + Number(currentRunningPoint + (currentRemainingBalls - 1)));
        });
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
    
    // ターン情報の登録 & マッチの更新
    async function registerTurn(remainBallValue) {
        
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

            if ( remainBallValue == 0 ) {   // 今回落としてない
                remainBallValue = currentMatch.remainingBalls;
            }

            const nextRemainingBalls = Number(remainBallValue);
            const currentRunningPoint = currentMatch.runningPoint;
            const point = currentRunningPoint + currentMatch.remainingBalls - nextRemainingBalls;
            const currentState = createCurrentState(currentMatch);
            const newTurnNo = currentMatch.lastTurnNo + 1;
            
            // テーブル状況更新
            if ( nextRemainingBalls != currentMatch.remainingBalls) {
                setTableCondition( tableCondition + ", " + (nextRemainingBalls - 15));
            }
            else if ( currentRunningPoint > 0 )
            {
                // ラックを跨げなかった
                setTableCondition( tableCondition + " X" );
            }

            // 連続ファールチェック
            const isContinusFoul = checkContinusFaul( currentMatch.currentPlayerId, isFoul );

            let score = currentMatch.currentPlayerId === currentMatch.player1Id
                ? currentMatch.player1Score
                : currentMatch.player2Score;
            score += isFoul ? isContinusFoul ? - 15 : - 1 : 0;

            // Turnを作成
            const turnRef = doc(collection(db, "matches", currentMatch.id, "turns"));
            transaction.set(turnRef, {
                matchId: currentMatch.id,
                turnNo: currentMatch.lastTurnNo + 1,
                playerId: currentMatch.currentPlayerId,
                inning: currentMatch.inning,
                point: point,
                score: score + point,
                remainingBalls: nextRemainingBalls,
                createdAt: serverTimestamp(),
                isSafty: isSafty,
                isFoul: isFoul,
                runningPoint: currentRunningPoint,
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
                tableCondition : tableCondition,
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
                turn.isFoul ? turn.isContinusFoul ? turn.point - 15 : turn.point - 1 : turn.point
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

                <div>
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
                </div>
            </div>

            <div>
                MatchID : {match?.id}
            </div>

            <div>
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
                <h2>Input</h2>
                <div>
                    <div>
                        Balls missing from the table : 
                    </div>
                    <button onClick={rackBalls} disabled={match?.status !== "playing"}>Rack</button>
                    <button onClick={() => registerTurn(2)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 2}>-13</button>
                    <button onClick={() => registerTurn(3)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 3}>-12</button>
                    <button onClick={() => registerTurn(4)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 4}>-11</button>
                    <button onClick={() => registerTurn(5)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 5}>-10</button>
                    <button onClick={() => registerTurn(6)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 6}>-9</button>
                    <button onClick={() => registerTurn(7)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 7}>-8</button>
                    <button onClick={() => registerTurn(8)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 8}>-7</button>
                    <button onClick={() => registerTurn(9)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 9}>-6</button>
                    <button onClick={() => registerTurn(10)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 10}>-5</button>
                    <button onClick={() => registerTurn(11)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 11}>-4</button>
                    <button onClick={() => registerTurn(12)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 12}>-3</button>
                    <button onClick={() => registerTurn(13)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 13}>-2</button>
                    <button onClick={() => registerTurn(14)} disabled={match?.status !== "playing" || match?.remainingBalls - 1 < 14}>-1</button>
                    <button onClick={() => registerTurn(0)} disabled={match?.status !== "playing"}>―</button>
                </div>
            </div>

            <div style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                    <div>
                    <input
                        disabled={match?.status !== "playing"}
                        type="checkbox"
                        checked={isSafty}
                        onChange={(e) => setIsSafty(e.target.checked)}
                    />Safety
                    </div>
                    <div>
                    <input
                        disabled={match?.status !== "playing"}
                        type="checkbox"
                        checked={isFoul}
                        onChange={(e) => setIsFoul(e.target.checked)}
                    />Foul
                    </div>
                </div>
                <div>
                    <button onClick={() => rebuildMatch(match.id)}>
                        Rebuild Test
                    </button>
                </div>                
            </div>
            
            <div style={{ marginTop: "30px" }}>
                <h3>Score</h3>
                {
                    <table style={{
                        width: "100%",
                        maxWidth: "1000px",
                        borderCollapse: "collapse"
                    }}>
                        <thead>
                            <tr>
                                <th style={{ border: "1px solid #ccc" }}>Player</th>
                                <th style={{ border: "1px solid #ccc" }}>1</th>
                                <th style={{ border: "1px solid #ccc" }}>2</th>
                                <th style={{ border: "1px solid #ccc" }}>3</th>
                                <th style={{ border: "1px solid #ccc" }}>4</th>
                                <th style={{ border: "1px solid #ccc" }}>5</th>
                                <th style={{ border: "1px solid #ccc" }}>6</th>
                                <th style={{ border: "1px solid #ccc" }}>7</th>
                                <th style={{ border: "1px solid #ccc" }}>8</th>
                                <th style={{ border: "1px solid #ccc" }}>9</th>
                                <th style={{ border: "1px solid #ccc" }}>10</th>
                                <th style={{ border: "1px solid #ccc" }}>11</th>
                                <th style={{ border: "1px solid #ccc" }}>12</th>
                                <th style={{ border: "1px solid #ccc" }}>13</th>
                                <th style={{ border: "1px solid #ccc" }}>14</th>
                                <th style={{ border: "1px solid #ccc" }}>15</th>
                            </tr>
                        </thead>

                        <tbody>
                                <tr>
                                    <td
                                        style={{
                                            border: "1px solid #ccc",
                                            textAlign: "center",
                                            padding: "1px"
                                        }}
                                    >
                                        {match?.player1Name} 
                                        <br/>
                                        {match?.player1WinningScore}

                                    </td>
                                        {
                                            turns.map((turn) => {
                                                if (turn.playerId === match.player1Id) {
                                                    return <td key={turn.id}
                                                                style={{
                                                                    border: "1px solid #ccc",
                                                                    textAlign: "center",
                                                                    padding: "2px",
                                                                    width: "50px"
                                                                }}                                                    
                                                            >
                                                        <input
                                                            type="text"
                                                            value={formatTurn(turn)}
                                                            readOnly
                                                            style={{ 
                                                                width: "100%", 
                                                                boxSizing: "border-box", 
                                                                textAlign: "center" }}
                                                        />
                                                        <br/>
                                                        {turn.score}
                                                    </td>;
                                                }
                                                return "";
                                            })
                                        }
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            border: "1px solid #ccc",
                                            textAlign: "center",
                                            padding: "1px"
                                        }}                                   
                                    >
                                        {match?.player2Name}
                                        <br/>
                                        {match?.player2WinningScore}
                                    </td>
                                        {
                                            turns.map((turn) => {
                                                if (turn.playerId === match.player2Id) {
                                                    return <td key={turn.id}
                                                                style={{
                                                                    border: "1px solid #ccc",
                                                                    textAlign: "center",
                                                                    padding: "2px",
                                                                    width: "50px",
                                                                }}>
                                                        <input
                                                            type="text"
                                                            value={formatTurn(turn)}
                                                            readOnly
                                                            style={{ 
                                                                width: "100%", 
                                                                boxSizing: "border-box", 
                                                                textAlign: "center" }}
                                                        />
                                                        <br/>
                                                        {turn.score}
                                                    </td>;
                                                }
                                                return "";
                                            })
                                        }
                                </tr>
                       </tbody>
                    </table>   
                }
                tableProgress : {tableCondition}
            </div>
        </div>
    );
}
export default Game;