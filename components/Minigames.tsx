import React, { useEffect, useState, useRef } from 'react';
import { GameData, GameState, MinigameType } from '../types';
import { updateRoom } from '../firebaseService';
import { Zap, Bomb, Beer, AlertTriangle, Swords } from 'lucide-react';

interface MinigamesProps {
  roomData: GameData;
  userId: string;
}

const Minigames: React.FC<MinigamesProps> = ({ roomData, userId }) => {
  const isHost = roomData.hostId === userId;
  const challengerId = roomData.currentLoserId || "";
  const defenderId = roomData.targetOpponentId || "";
  
  const challenger = roomData.players[challengerId] || { name: "Người chơi 1" };
  const defender = roomData.players[defenderId] || { name: "Người chơi 2" };
  
  const isPlayer = userId === challengerId || userId === defenderId;
  const gameState = (roomData as any).minigameState;

  const [localCountdown, setLocalCountdown] = useState(3);
  const [tapCount, setTapCount] = useState(0);
  const [gameTimeLeft, setGameTimeLeft] = useState(10); 
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // 1. INIT GAME
  useEffect(() => {
    if (!isHost) return;
    if (!gameState || (roomData.minigameType === MinigameType.MEMORY && !gameState.cards)) {
      const randomBase = (Math.floor(Math.random() * 5) + 1) / 10;
      let cards: string[] = [];
      if (roomData.minigameType === MinigameType.MEMORY) {
         cards = ['safe', 'safe', 'safe', 'safe', 'safe', 'bomb'];
         for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
         }
      }
      updateRoom(roomData.id, {
        minigameState: {
          basePenalty: randomBase,
          cards: cards,
          flipped: [],
          currentTurn: challengerId,
          canAttack: false,
          loser: null
        }
      });
    }
  }, [roomData.minigameType, isHost, roomData.id, gameState]);

  // 2. COUNTDOWN 3s
  useEffect(() => {
    if ((roomData.minigameType === MinigameType.FAST_HANDS || roomData.minigameType === MinigameType.TAP_WAR) && !gameState?.canAttack) {
        const timer = setInterval(() => {
            setLocalCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        if (isHost && gameState && !gameState.canAttack) {
            const unlockTimer = setTimeout(() => {
                updateRoom(roomData.id, { 'minigameState/canAttack': true });
            }, 3000);
            return () => clearTimeout(unlockTimer);
        }
        return () => clearInterval(timer);
    }
  }, [roomData.minigameType, isHost, gameState?.canAttack]);

  // 3. COUNTDOWN 10s (TAP WAR)
  useEffect(() => {
      if (roomData.minigameType === MinigameType.TAP_WAR && gameState?.canAttack && isPlayer && !hasSubmitted) {
          const timer = setInterval(() => {
              setGameTimeLeft((prev) => {
                  if (prev <= 1) {
                      clearInterval(timer);
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
          return () => clearInterval(timer);
      }
  }, [roomData.minigameType, gameState?.canAttack, isPlayer, hasSubmitted]); 

  // 4. SUBMIT SCORE
  useEffect(() => {
      if (gameTimeLeft === 0 && !hasSubmitted && roomData.minigameType === MinigameType.TAP_WAR && isPlayer) {
          setHasSubmitted(true);
          sendMove(tapCount.toString());
      }
  }, [gameTimeLeft, hasSubmitted, roomData.minigameType, isPlayer, tapCount]); 

  // 5. REFEREE
  useEffect(() => {
    if (!isHost) return; 
    const p1Move = challenger?.minigameMove;
    const p2Move = defender?.minigameMove;

    if (roomData.minigameType === MinigameType.RPS) {
      if (p1Move && p2Move) {
        if (p1Move === p2Move) {
          setTimeout(() => {
             const updates: any = {};
             updates[`players/${challengerId}/minigameMove`] = null;
             updates[`players/${defenderId}/minigameMove`] = null;
             updateRoom(roomData.id, updates);
          }, 2000);
        } else if ((p1Move === 'rock' && p2Move === 'scissors') || (p1Move === 'scissors' && p2Move === 'paper') || (p1Move === 'paper' && p2Move === 'rock')) {
          finishGame(challengerId);
        } else {
          finishGame(defenderId);
        }
      }
    }

    if (roomData.minigameType === MinigameType.FAST_HANDS) {
       if (gameState?.canAttack) {
           if (p1Move) finishGame(challengerId);
           else if (p2Move) finishGame(defenderId);
       }
    }

    if (roomData.minigameType === MinigameType.TAP_WAR) {
        if (p1Move && p2Move) {
            const score1 = parseInt(p1Move);
            const score2 = parseInt(p2Move);
            setTimeout(() => {
                if (score1 > score2) finishGame(challengerId);
                else if (score2 > score1) finishGame(defenderId);
                else {
                    const updates: any = {};
                    updates[`players/${challengerId}/minigameMove`] = null;
                    updates[`players/${defenderId}/minigameMove`] = null;
                    updates['minigameState/canAttack'] = false; 
                    updateRoom(roomData.id, updates);
                }
            }, 1000);
        }
    }
  }, [roomData, isHost]);

  const finishGame = (winnerId: string) => {
    const basePenalty = gameState?.basePenalty || 0.1;
    const isChallengerWon = winnerId === challengerId;
    const loserId = isChallengerWon ? defenderId : challengerId;

    let finalAmount = basePenalty;
    if (loserId === challengerId) {
        finalAmount = basePenalty * 2;
    }
    finalAmount = Math.round(finalAmount * 10) / 10;

    updateRoom(roomData.id, {
        state: GameState.RESULT,
        winnerId: loserId,
        winnerBeerAmount: finalAmount,
        minigameState: null,
        nextControllerId: loserId 
    });
  };

  const handleFlipCard = (index: number) => {
    if (!gameState || gameState.loser || gameState.currentTurn !== userId) return;
    const flipped = gameState.flipped || [];
    if (flipped.includes(index)) return;

    const cards = gameState.cards || [];
    const isBomb = cards[index] === 'bomb';
    const newFlipped = [...flipped, index];

    if (isBomb) {
        const winnerId = userId === challengerId ? defenderId : challengerId;
        updateRoom(roomData.id, {
            'minigameState/flipped': newFlipped,
            'minigameState/loser': userId
        });
        setTimeout(() => { if (isHost) finishGame(winnerId); }, 2000);
    } else {
        const nextTurn = userId === challengerId ? defenderId : challengerId;
        updateRoom(roomData.id, {
            'minigameState/flipped': newFlipped,
            'minigameState/currentTurn': nextTurn
        });
    }
  };

  const sendMove = (move: string) => {
    if (!isPlayer) return;
    updateRoom(roomData.id, { [`players/${userId}/minigameMove`]: move });
  };

  if (!gameState || (roomData.minigameType === MinigameType.MEMORY && !gameState.cards)) {
      return <div className="flex flex-col items-center justify-center gap-4 mt-10"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div><div className="text-slate-400 animate-pulse">Đang thiết lập bàn chơi...</div></div>;
  }

  const penaltyDisplay = (
      <div className="bg-slate-900/90 px-6 py-4 rounded-2xl border border-amber-500/50 mb-6 text-center shadow-lg w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-1"><AlertTriangle className="text-amber-500" size={20} /><p className="text-slate-400 text-sm uppercase tracking-wider font-bold">Mức cược</p></div>
          <div className="text-4xl font-bungee text-amber-500">{gameState.basePenalty} LY</div>
          <div className="mt-2 text-xs text-slate-400 flex flex-col gap-1"><span className="text-rose-400">🔥 {challenger.name} thua: <span className="font-bold">{Math.round(gameState.basePenalty * 2 * 10)/10} ly</span> (x2)</span><span className="text-indigo-400">🛡️ {defender.name} thua: <span className="font-bold">{gameState.basePenalty} ly</span></span></div>
      </div>
  );

  if (roomData.minigameType === MinigameType.MEMORY) {
      const isMyTurn = gameState.currentTurn === userId;
      const cards = gameState.cards || []; 
      const flipped = gameState.flipped || [];
      return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-rose-500">LẬT THẺ TỬ THẦN</h2>
            <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-600 mb-2">Lượt của: <span className={`font-bold ${isMyTurn ? 'text-green-400' : 'text-slate-300'}`}>{isMyTurn ? "BẠN" : roomData.players[gameState.currentTurn]?.name}</span></div>
            <div className="grid grid-cols-3 gap-3">
                {cards.map((cardType: string, index: number) => {
                    const isFlipped = flipped.includes(index);
                    return (
                        <button key={index} onClick={() => handleFlipCard(index)} disabled={isFlipped || !isMyTurn || !!gameState.loser} className={`w-24 h-32 rounded-xl border-4 transition-all duration-500 relative ${isFlipped ? (cardType === 'bomb' ? 'bg-rose-600 border-rose-400' : 'bg-emerald-600 border-emerald-400') : 'bg-slate-700 border-slate-500'}`}>
                            <div className="flex items-center justify-center h-full w-full">{isFlipped ? (cardType === 'bomb' ? <Bomb size={40} className="text-white animate-bounce"/> : <Beer size={40} className="text-white"/>) : <span className="text-2xl font-bold text-slate-500">?</span>}</div>
                        </button>
                    );
                })}
            </div>
            {gameState.loser && <div className="text-2xl font-bold text-rose-500 animate-ping mt-4">BÙÙÙÙM!!! 💥</div>}
        </div>
      );
  }

  if (roomData.minigameType === MinigameType.RPS) {
    const myMove = roomData.players[userId]?.minigameMove;
    const opponentHasMoved = !!roomData.players[userId === challengerId ? defenderId : challengerId]?.minigameMove;
    return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-indigo-400">OẲN TÙ TÌ</h2>
            <div className="flex justify-between w-full max-w-lg px-4 text-center"><div><p className="font-bold text-rose-400">{challenger.name}</p>{challenger.minigameMove && <div className="mt-1 text-xl">✅</div>}</div><div className="text-2xl font-bungee">VS</div><div><p className="font-bold text-indigo-400">{defender.name}</p>{defender.minigameMove && <div className="mt-1 text-xl">✅</div>}</div></div>
            {isPlayer ? (
                myMove ? <div className="text-xl text-yellow-400 animate-pulse mt-8">{opponentHasMoved ? "Đang tính..." : "Đang chờ đối thủ..."}</div> :
                <div className="grid grid-cols-3 gap-4 mt-8">{['rock', 'paper', 'scissors'].map(m => (<button key={m} onClick={() => sendMove(m)} className="w-20 h-20 bg-slate-800 rounded-full text-4xl border-4 border-slate-600 hover:bg-slate-700">{m === 'rock' ? '✊' : m === 'paper' ? '✋' : '✌️'}</button>))}</div>
            ) : <p className="text-slate-500">Đang xem thi đấu...</p>}
        </div>
    );
  }

  if (roomData.minigameType === MinigameType.FAST_HANDS) {
      const canClick = gameState.canAttack; 
      return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-yellow-500">NHANH TAY LẸ MẮT</h2>
            <div className="relative h-64 w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center">{isPlayer ? (canClick ? (<button onClick={() => sendMove(Date.now().toString())} className="w-40 h-40 bg-red-600 rounded-full shadow-[0_0_60px_rgba(220,38,38,0.8)] animate-bounce active:scale-90 transition-transform flex items-center justify-center cursor-pointer hover:bg-red-500 border-4 border-white"><Zap size={80} className="text-white fill-yellow-300" /></button>) : (<div className="text-9xl font-bold text-white animate-ping font-bungee">{localCountdown === 0 ? "GO!" : localCountdown}</div>)) : (<div className="flex flex-col items-center"><div className="text-slate-500 mb-4">Đang xem thi đấu...</div><div className="text-6xl font-bold text-slate-700">{localCountdown}</div></div>)}</div>
            {!canClick && <p className="text-slate-400 animate-pulse mt-4">Chuẩn bị...</p>}
            {canClick && <p className="text-rose-500 font-bold text-2xl animate-bounce mt-4">BẤM NGAY!!!</p>}
        </div>
      );
  }

  if (roomData.minigameType === MinigameType.TAP_WAR) {
      const canClick = gameState.canAttack; 
      return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <div className="flex items-center gap-3"><Swords className="text-orange-500" size={32} /><h2 className="text-3xl font-bungee text-orange-500">LOẠN ĐẢ MÀN HÌNH</h2></div>
            <div className="relative w-full max-w-md">{isPlayer ? (canClick ? (<div className="flex flex-col items-center gap-4"><div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500 transition-all duration-1000 ease-linear" style={{ width: `${(gameTimeLeft / 10) * 100}%` }}></div></div><p className="text-slate-400 font-bold uppercase tracking-widest">Thời gian: {gameTimeLeft}s</p>{hasSubmitted ? (<div className="p-8 text-2xl font-bold text-white bg-slate-800 rounded-2xl animate-pulse">Đang chờ kết quả...</div>) : (<button onClick={() => setTapCount(prev => prev + 1)} className="w-48 h-48 bg-orange-600 active:bg-orange-700 rounded-full border-8 border-slate-900 shadow-[0_0_50px_rgba(234,88,12,0.5)] flex flex-col items-center justify-center active:scale-95 transition-all"><span className="text-6xl font-black text-white pointer-events-none">{tapCount}</span><span className="text-xs font-bold text-orange-200 pointer-events-none uppercase">Lượt bấm</span></button>)}<p className="text-slate-400 animate-bounce mt-2 text-sm">BẤM LIÊN TỤC VÀO NÚT TRÒN!</p></div>) : (<div className="h-64 flex flex-col items-center justify-center bg-slate-900 rounded-3xl border border-slate-700"><div className="text-9xl font-bold text-white animate-ping font-bungee">{localCountdown === 0 ? "FIGHT!" : localCountdown}</div><p className="mt-4 text-slate-500">Chuẩn bị ngón tay...</p></div>)) : (<div className="h-64 flex flex-col items-center justify-center bg-slate-900 rounded-3xl border border-slate-700 p-8 text-center"><Swords size={48} className="text-slate-600 mb-4" /><h3 className="text-xl font-bold text-white mb-2">Cuộc chiến ngón tay</h3><p className="text-slate-400">{canClick ? "Hai đấu thủ đang bấm điên cuồng..." : `Trận đấu bắt đầu sau ${localCountdown}s`}</p></div>)}</div>
        </div>
      );
  }

  return <div className="text-center">Loading game data...</div>;
};

export default Minigames;
