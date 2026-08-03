import { useEffect, useState } from "react";
import { db } from "../firebase";

import {
    collection,
    onSnapshot,
    query,
    orderBy,
} from "firebase/firestore";

function MatchList({ onOpen }) {

    const [matches, setMatches] = useState([])
    const [players, setPlayers] = useState([]);

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
                collection(db, "matches"),
                orderBy("createdAt", "desc")
            ),
            (snapshot) => {
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMatches(list);
            }
        );
        return unsubscribe;
    }, []);

    return (
        <div>
            <h2>Match List</h2>
            {
                matches.map(match => (
                    <div
                        key={match.id}
                        style={{
                            border: "1px solid gray",
                            marginBottom: "10px",
                            padding: "10px"
                        }}
                    >
                        <div>
                            {
                                players.find(p => p.id === match.player1Id)?.name
                                ?? "?"
                            }
                            {" vs "}
                            {
                                players.find(p => p.id === match.player2Id)?.name
                                ?? "?"
                            }
                        </div>
                        <div>
                            {match.player1Score}
                            {" - "}
                            {match.player2Score}
                        </div>
                        <div style={{ marginTop: "10px" }}>
                            <button
                                onClick={() => onOpen(match.id)}
                            >
                                Open
                            </button>
                        </div>
                    </div>
                ))
            }
        </div>
    );
    }

export default MatchList;