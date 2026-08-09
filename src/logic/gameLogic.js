// 試合開始時のStateを作る
export function createInitialState(match) {

    return {
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        breakPlayerId: match.breakPlayerId,
        player1Score: 0,
        player2Score: 0,
        currentPlayerId: match.breakPlayerId,
        inning: 1,
        winnerId: null,
        status: "playing",
        runningScore: 0,
        remainingBalls: 15,
    };
}

// 今のStateを作る
export function createCurrentState(match) {
    return {
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        breakPlayerId: match.breakPlayerId,
        player1Score: match.player1Score,
        player2Score: match.player2Score,
        currentPlayerId: match.currentPlayerId,
        inning: match.inning,
        runningScore: match.runningScore ?? 0,
        remainingBalls: match.remainingBalls
    };
}


// 次のStateを作成する
export function createNextState(state, inputScore) {
    const newPlayer1Score =
        state.currentPlayerId === state.player1Id
            ? state.player1Score + inputScore
            : state.player1Score;
    const newPlayer2Score =
        state.currentPlayerId === state.player2Id
            ? state.player2Score + inputScore
            : state.player2Score;
    const newCurrentPlayerId =
        state.currentPlayerId === state.player1Id
            ? state.player2Id
            : state.player1Id;
    let newInning = state.inning;
    if (newCurrentPlayerId === state.breakPlayerId) {
        newInning++;
    }
    return {
        ...state,
        player1Score: newPlayer1Score,
        player2Score: newPlayer2Score,
        currentPlayerId: newCurrentPlayerId,
        inning: newInning,
        remainingBalls: state.remainingBalls,
        runningScore: 0
    };
}

// 勝敗判定    
export function judgeWinner(currentMatch , nextState )
{
    const player1Win =
        nextState.player1Score >= currentMatch.player1WinningScore;
    const player2Win =
        nextState.player2Score >= currentMatch.player2WinningScore;
    const draw =
        nextState.inning > currentMatch.maxInning &&
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
