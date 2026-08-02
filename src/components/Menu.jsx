function Menu({ onSelect }) {

    return (
        <div style={{ marginBottom: "20px" }}>

            <button onClick={() => onSelect("players")}>
                プレイヤー管理
            </button>

            <button
                onClick={() => onSelect("match")}
                style={{ marginLeft: "10px" }}
            >
                試合開始
            </button>
            
            <button onClick={() => onSelect("matches")}>
                試合一覧
            </button>
        </div>
    );
}

export default Menu;