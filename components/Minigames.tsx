import React, { useEffect, useState } from 'react';
import { GameData, GameState, MinigameType, Player } from '../types';
import { updateRoom } from '../firebaseService';
import { Hand, Zap, Bomb, Beer, Skull, Timer } from 'lucide-react';

interface MinigamesProps {
  roomData: GameData;
  userId: string;
}

const Minigames: React.FC<MinigamesProps> = ({ roomData, userId }) => {
  const isHost = roomData.hostId === userId;
  const challengerId = roomData.currentLoserId!;
  const defenderId = roomData.targetOpponentId!;
  const challenger = roomData.players[challengerId];
  const defender = roomData.players[defenderId];
  
  const isPlayer = userId === challengerId || userId === defenderId;
  
  // Lấy state game từ Firebase
  const gameState = (roomData as any).minigameState;

  // State đếm ngược cục bộ (cho hiệu ứng hiển thị)
  const [countdown, setCountdown] = useState<number | null>(null);

  // --- 1. KHỞI TẠO GAME (HOST) ---
  useEffect(() => {
    if (!isHost) return;

    // Nếu chưa có dữ liệu minigameState thì khởi tạo
    if (!gameState) {
      // 1. Random mức cược từ 0.1 đến 0.5
      const basePenalty = (Math.floor(Math.random() * 5) + 1) / 10;

      // 2. Cấu hình riêng cho game Lật Thẻ (Bomb)
      let cards: string[] = [];
      if (roomData.minigameType === MinigameType.MEMORY) {
         cards = ['safe', 'safe', 'safe', 'safe', 'safe', 'bomb'];
         for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
         }
      }

      // 3. Đẩy dữ liệu khởi tạo lên Firebase
      updateRoom(roomData.id, {
        minigameState: {
          basePenalty: basePenalty, // Lưu mức cược gốc
          cards: cards,             // Bộ bài (nếu là game bài)
          flipped: [],
          currentTurn: challengerId,
          loser: null
        }
      });
    }
  }, [roomData.minigameType, isHost, roomData.id, gameState]);

  // --- 2. LOGIC ĐẾM NGƯỢC (FAST HANDS) ---
  useEffect(() => {
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
        setCountdown(3); 
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev === 1) {
                    clearInterval(timer);
                    return 0; // 0 là lúc được phép bấm
                }
                return (prev !== null && prev > 0) ? prev - 1 : 0; 
            });
        }, 1000); // Đếm mỗi 1 giây
        return () => clearInterval(timer);
    }
  }, [roomData.minigameType]);

  // --- 3. TRỌNG TÀI XỬ THẮNG THUA (HOST) ---
  useEffect(() => {
    if (!isHost) return; 

    const p1Move = challenger?.minigameMove;
    const p2Move = defender?.minigameMove;

    // A. GAME OẲN TÙ TÌ
    if (roomData.minigameType === MinigameType.RPS) {
      if (p1Move && p2Move) {
        if (p1Move === p2Move) {
          setTimeout(() => {
             const updates: any = {};
             updates[`players/${challengerId}/minigameMove`] = null;
             updates[`players/${defenderId}/minigameMove`] = null;
             updateRoom(roomData.id, updates);
          }, 2000);
          return;
        }
        if (
          (p1Move === 'rock' && p2Move === 'scissors') ||
          (p1Move === 'scissors' && p2Move === 'paper') ||
          (p1Move === 'paper' && p2Move === 'rock')
        ) {
          finishGame(challengerId);
        } else {
          finishGame(defenderId);
        }
      }
    }

    // B. GAME NHANH TAY
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
       if (p1Move) finishGame(challengerId);
       else if (p2Move) finishGame(defenderId);
    }

  }, [roomData, isHost]);

  // --- 4. HÀM KẾT THÚC & TÍNH PHẠT ---
  const finishGame = (winnerId: string) => {
    // Lấy mức cược gốc
    const basePenalty = gameState?.basePenalty || 1;

    const isChallengerWon = winnerId === challengerId;
    const loserId = isChallengerWon ? defenderId : challengerId;
    
    // LUẬT PHẠT:
    // - Nếu Người thách đấu (challenger) THUA: Phạt gấp đôi (base * 2)
    // - Nếu Người bị thách đấu (defender) THUA: Phạt mức gốc (base)
    // (Lưu ý: challenger thua nghĩa là defender thắng)
    let finalAmount = basePenalty;
    if (loserId === challengerId) {
        finalAmount = basePenalty * 2;
    }

    // Làm tròn số thập phân (ví dụ 0.300004 -> 0.3)
    finalAmount = Math.round(finalAmount * 10) / 10;

    updateRoom(roomData.id, {
        state: GameState.RESULT,
        winnerId: loserId, 
        winnerBeerAmount: finalAmount,
        minigameState: null // Reset
    });
  };

  // --- 5. LOGIC GAME LẬT THẺ ---
  const handleFlipCard = (index: number) => {
    if (!gameState || gameState.loser) return;
    if (gameState.currentTurn !== userId) return;
    if (gameState.flipped.includes(index)) return;

    const isBomb = gameState.cards[index] === 'bomb';
    const newFlipped = [...gameState.flipped, index];

    if (isBomb) {
        // Nổ boom!
        const winnerId = userId === challengerId ? defenderId : challengerId;
        updateRoom(roomData.id, {
            'minigameState/flipped': newFlipped,
            'minigameState/loser': userId
        });
        setTimeout(() => {
            if (isHost || userId === roomData.hostId) finishGame(winnerId);
        }, 2000);
    } else {
        // An toàn
        const nextTurn = userId === challengerId ? defenderId : challengerId;
        updateRoom(roomData.id, {
            'minigameState/flipped': newFlipped,
            'minigameState/currentTurn': nextTurn
        });
    }
  };

  // --- GỬI HÀNH ĐỘNG ---
  const sendMove = (move: string) => {
    if (!isPlayer) return;
    updateRoom(roomData.id, {
        [`players/${userId}/minigameMove`]: move
    });
  };

  // Nếu chưa khởi tạo xong (đang random cược) thì hiện loading
  if (!gameState) return <div className="text-white animate-pulse text-center mt-10">Đang đặt cược...</div>;

  // --- GIAO DIỆN CHUNG: HIỂN THỊ MỨC CƯỢC ---
  const penaltyDisplay = (
      <div className="bg-slate-900/80 px-6 py-3 rounded-xl border border-amber-500/50 mb-6 text-center">
          <p className="text-slate-400 text-sm uppercase tracking-wider">Mức cược trận này</p>
          <div className="text-3xl font-bungee text-amber-500">{gameState.basePenalty} LY</div>
          <div className="text-xs text-rose-400 italic mt-1">
             (Nếu {challenger.name} thua sẽ bị phạt x2: {Math.round(gameState.basePenalty * 2 * 10)/10} ly)
          </div>
      </div>
  );

  // --- RENDER TỪNG GAME ---
  
  // 1. GAME LẬT THẺ (BOMB)
  if (roomData.minigameType === MinigameType.MEMORY) {
      const isMyTurn = gameState.currentTurn === userId;
      const turnName = roomData.players[gameState.currentTurn]?.name;

      return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-rose-500">LẬT THẺ TỬ THẦN</h2>
            
            <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-600 mb-2">
                Lượt của: <span className={`font-bold ${isMyTurn ? 'text-green-400' : 'text-slate-300'}`}>
                    {isMyTurn ? "BẠN" : turnName}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {gameState.cards.map((cardType: string, index: number) => {
                    const isFlipped = gameState.flipped.includes(index);
                    return (
                        <button
                            key={index}
                            onClick={() => handleFlipCard(index)}
                            disabled={isFlipped || !isMyTurn || !!gameState.loser}
                            className={`
                                w-24 h-32 rounded-xl border-4 transition-all duration-500 relative
                                ${isFlipped 
                                    ? (cardType === 'bomb' ? 'bg-rose-600 border-rose-400' : 'bg-emerald-600 border-emerald-400') 
                                    : 'bg-slate-700 border-slate-500 hover:border-white'
                                }
                            `}
                        >
                            <div className="flex items-center justify-center h-full w-full">
                                {isFlipped ? (
                                    cardType === 'bomb' ? <Bomb size={40} className="text-white animate-bounce"/> : <Beer size={40} className="text-white"/>
                                ) : (
                                    <span className="text-2xl font-bold text-slate-500">?</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
            {gameState.loser && <div className="text-2xl font-bold text-rose-500 animate-ping mt-4">BÙÙÙÙM!!! 💥</div>}
        </div>
      );
  }

  // 2. GAME OẲN TÙ TÌ
  if (roomData.minigameType === MinigameType.RPS) {
    const myMove = roomData.players[userId]?.minigameMove;
    const opponentId = userId === challengerId ? defenderId : challengerId;
    const opponentHasMoved = !!roomData.players[opponentId]?.minigameMove;

    return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-indigo-400">OẲN TÙ TÌ</h2>
            
            <div className="flex justify-between w-full max-w-lg px-4 text-center">
                 <div>
                    <p className="font-bold text-rose-400">{challenger.name}</p>
                    {challenger.minigameMove && <div className="mt-1 text-xl">✅</div>}
                 </div>
                 <div className="text-2xl font-bungee">VS</div>
                 <div>
                    <p className="font-bold text-indigo-400">{defender.name}</p>
                    {defender.minigameMove && <div className="mt-1 text-xl">✅</div>}
                 </div>
            </div>

            {isPlayer ? (
                myMove ? (
                    <div className="text-xl text-yellow-400 animate-pulse mt-8">
                        {opponentHasMoved ? "Đang tính..." : "Đang chờ đối thủ..."}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <button onClick={() => sendMove('rock')} className="w-20 h-20 bg-slate-800 rounded-full text-4xl border-4 border-slate-600 hover:bg-slate-700">✊</button>
                        <button onClick={() => sendMove('paper')} className="w-20 h-20 bg-slate-800 rounded-full text-4xl border-4 border-slate-600 hover:bg-slate-700">✋</button>
                        <button onClick={() => sendMove('scissors')} className="w-20 h-20 bg-slate-800 rounded-full text-4xl border-4 border-slate-600 hover:bg-slate-700">✌️</button>
                    </div>
                )
            ) : <p className="text-slate-500 mt-4">Đang xem thi đấu...</p>}
        </div>
    );
  }

  // 3. GAME NHANH TAY LẸ MẮT (Đã update logic công bằng)
  if (roomData.minigameType === MinigameType.FAST_HANDS) {
      return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-yellow-500">NHANH TAY LẸ MẮT</h2>
            
            <div className="relative h-64 w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center">
                {isPlayer ? (
                    // Chỉ hiển thị nút khi countdown đã về 0
                    countdown === 0 ? (
                        <button 
                            onClick={() => sendMove(Date.now().toString())}
                            className="w-32 h-32 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce active:scale-90 transition-transform flex items-center justify-center cursor-pointer hover:bg-red-500"
                        >
                            <Zap size={64} className="text-white fill-yellow-300" />
                        </button>
                    ) : (
                        // Đang đếm ngược
                        <div className="text-9xl font-bold text-white animate-ping">
                            {countdown}
                        </div>
                    )
                ) : (
                    // Màn hình Khán giả
                    <div className="flex flex-col items-center">
                        <div className="text-slate-500 mb-4">Đang xem thi đấu...</div>
                        {countdown !== null && countdown > 0 && (
                             <div className="text-6xl font-bold text-slate-700">{countdown}</div>
                        )}
                        {countdown === 0 && <div className="text-rose-500 font-bold">FIGHT!</div>}
                    </div>
                )}
            </div>
            
            {countdown !== null && countdown > 0 && <p className="text-slate-400 animate-pulse">Chuẩn bị...</p>}
            {countdown === 0 && <p className="text-rose-500 font-bold text-xl animate-bounce">BẤM NGAY!!!</p>}
        </div>
      );
  }

  return <div className="text-center text-slate-400">Loading...</div>;
};

export default Minigames;
