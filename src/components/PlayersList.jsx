import { useEffect, useState } from "react";
import { 
    collection, 
    addDoc, 
    onSnapshot,
    deleteDoc,
    updateDoc,
    doc
} from "firebase/firestore";
import { db } from "../firebase";

function PlayerList() {

    const [players, setPlayers] = useState([]);
    const [name, setName] = useState("");
    const [winningScore, setWinningScore] = useState("");
    const [editingId, setEditingId] = useState(null);

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
        return () => unsubscribe();
    }, []);

    async function loadPlayers() {
        const snapshot = await getDocs(collection(db, "players"));
        const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setPlayers(list);
    }

    async function addPlayer() {
        await addDoc(collection(db, "players"), {
            name: name,
            winningScore: Number(winningScore),
        });

        loadPlayers();
        setName("");
        setWinningScore("");
    }

    async function deletePlayer(id) {
        if (!window.confirm("Are you sure you want to delete?")){
            return;
        }
        await deleteDoc(doc(db, "players", id));
    }

    async function updatePlayer() {
        await updateDoc(doc(db, "players", editingId), {
            name: name,
            winningScore: Number(winningScore)
        });
        setEditingId(null);
        setName("");
        setWinningScore("");
    }

    function startEdit(player) {
        setEditingId(player.id);
        setName(player.name);
        setWinningScore(player.winningScore);
    }

    return (
        <div>

            <h2>Player List</h2>
            
            <div>

                Name

                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                w-Score

                <input
                    value={winningScore}
                    onChange={(e) => setWinningScore(e.target.value)}
                />

                <button
                    onClick={editingId ? updatePlayer : addPlayer}
                >
                    {editingId ? "Update" : "Add"}
                </button>
            </div>
            <ul>
                {players.map(player => (
                    <li key={player.id}>
                        {player.name}
                        w-Score {player.winningScore}
                        <button
                            onClick={() => startEdit(player)}
                        >
                            Edit
                        </button>
                        <button 
                            onClick={() => deletePlayer(player.id)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default PlayerList;