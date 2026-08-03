function Menu({ onSelect }) {

    return (
        <div style={{ marginBottom: "20px" }}>

            <button onClick={() => onSelect("players")}>
                Player Management
            </button>

            <button
                onClick={() => onSelect("match")}
                style={{ marginLeft: "10px" }}
            >
                Start Match
            </button>
            
            <button 
                onClick={() => onSelect("matches")}
                style={{ marginLeft: "10px" }}
            >
                Match List
            </button>
        </div>
    );
}

export default Menu;