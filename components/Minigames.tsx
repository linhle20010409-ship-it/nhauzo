import React, { useEffect, useState, useRef } from 'react';
import { GameData, GameState, MinigameType } from '../types';
import { updateRoom } from '../firebaseService';
import { Zap, Bomb, Beer, AlertTriangle } from 'lucide-react';

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
  const gameState = (roomData as any).minigameState;

  // Local state để hiển thị đếm ngược cho đẹp mắt
  const [localCountdown, setLocalCountdown] = useState(3);

  // --- 1. KHỞI TẠO GAME (CHỈ HOST CHẠY) ---
  useEffect(() => {
    if (!isHost) return;

    // Nếu chưa có dữ liệu game thì tạo mới
    if (!gameState) {
      // a. Random mức cược từ 0.1 đến 0.5
      const randomBase = (Math.floor(Math.random() * 5) + 1) / 10;

      // b. Cấu hình bài cho game Lật Thẻ
      let cards: string[] = [];
      if (roomData.minigameType === MinigameType.MEMORY) {
         cards = ['safe', 'safe', 'safe', 'safe', 'safe', 'bomb'];
         // Shuffle
         for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
         }
      }

      // c. Đẩy lên Firebase
      updateRoom(roomData.id, {
        minigameState: {
          basePenalty: randomBase,
          cards: cards,
          flipped: [],
          currentTurn: challengerId,
          canAttack: false, // Biến quan trọng cho game Nhanh Tay
          loser: null
        }
      });
    }
  }, [roomData.minigameType, isHost, roomData.id, gameState]);

  // --- 2. LOGIC ĐẾM NGƯỢC CÔNG BẰNG (HOST ĐIỀU KHIỂN) ---
  useEffect(() => {
    // Chỉ chạy ở game Nhanh Tay
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
        
        // Hiệu ứng đếm ngược ở client (chỉ để hiển thị)
        const timer = setInterval(() => {
            setLocalCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        // Host chịu trách nhiệm mở khóa nút bấm sau 3 giây
        if (isHost && gameState && !gameState.canAttack) {
            const unlockTimer = setTimeout(() => {
                updateRoom(roomData.id, { 'minigameState/canAttack': true });
            }, 3000); // Sau đúng 3000ms thì Host cho phép bấm
            return () => clearTimeout(unlockTimer);
        }

        return () => clearInterval(timer);
    }
  }, [roomData.minigameType, isHost, gameState?.canAttack]);

  // --- 3. TRỌNG TÀI (HOST XỬ LÝ KẾT QUẢ) ---
  useEffect(() => {
    if (!isHost) return; 

    const p1Move = challenger?.minigameMove;
    const p2Move = defender?.minigameMove;

    // A. GAME OẲN TÙ TÌ
    if (roomData.minigameType === MinigameType.RPS) {
      if (p1Move && p2Move) {
        if (p1Move === p2Move) {
          // Hòa -> Reset sau 2s
          setTimeout(() => {
             const updates: any = {};
             updates[`players/${challengerId}/minigameMove`] = null;
             updates[`players/${defenderId}/minigameMove`] = null;
             updateRoom(roomData.id, updates);
          }, 2000);
        } else if (
          (p1Move === 'rock' && p2Move === 'scissors') ||
          (p1Move === 'scissors' && p2Move === 'paper') ||
          (p1Move === 'paper' && p2Move === 'rock')
        ) {
          finishGame(challengerId); // Challenger thắng
        } else {
          finishGame(defenderId); // Defender thắng
        }
      }
    }

    // B. GAME NHANH TAY (Ai bấm trước thắng)
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
       // Chỉ xử lý khi canAttack = true (đề phòng bấm trước khi cho phép)
       if (gameState?.canAttack) {
           if (p1Move) finishGame(challengerId);
           else if (p2Move) finishGame(defenderId);
       }
    }
  }, [roomData, isHost]);

  // --- 4. HÀM TÍNH TOÁN HÌNH PHẠT (QUAN TRỌNG) ---
  const finishGame = (winnerId: string) => {
    const basePenalty = gameState?.basePenalty || 0.1;
    const isChallengerWon = winnerId === challengerId;
    
    // Xác định người thua
    const loserId = isChallengerWon ? defenderId : challengerId;

    // LUẬT NHÂN ĐÔI:
    let finalAmount = basePenalty;

    if (loserId === challengerId) {
        // Nếu Người thách đấu (Kẻ thua cũ) lại thua tiếp -> Gấp đôi
        finalAmount = basePenalty * 2;
    } 
    // Nếu Người bị thách đấu thua -> Giữ nguyên mức gốc

    // Làm tròn số đẹp (ví dụ 0.60000001 -> 0.6)
    finalAmount = Math.round(finalAmount * 10) / 10;

    updateRoom(roomData.id, {
        state: GameState.RESULT,
        winnerId: loserId,
        winnerBeerAmount: finalAmount,
        minigameState: null // Reset state
    });
  };

  // --- 5. LOGIC LẬT THẺ ---
  const handleFlipCard = (index: number) => {
    if (!gameState || gameState.loser || gameState.currentTurn !== userId) return;
    if (gameState.flipped.includes(index)) return;

    const isBomb = gameState.cards[index] === 'bomb';
    const newFlipped = [...gameState.flipped, index];

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

  if (!gameState) return <div className="text-white animate-pulse text-center mt-10">Đang quay random mức cược...</div>;

  // --- GIAO DIỆN HIỂN THỊ MỨC CƯỢC ---
  const penaltyDisplay = (
      <div className="bg-slate-900/90 px-6 py-4 rounded-2xl border border-amber-500/50 mb-6 text-center shadow-lg">
          <div className="flex items-center justify-center gap-2 mb-1">
             <AlertTriangle className="text-amber-500" size={20} />
             <p className="text-slate-400 text-sm uppercase tracking-wider font-bold">Mức cược trận này</p>
          </div>
          <div className="text-4xl font-bungee text-amber-500">{gameState.basePenalty} LY</div>
          
          <div className="mt-2 text-xs text-slate-400 flex flex-col gap-1">
             <span className="text-rose-400">🔥 Nếu {challenger.name} thua: <span className="font-bold">{Math.round(gameState.basePenalty * 2 * 10)/10} ly</span> (x2)</span>
             <span className="text-indigo-400">🛡️ Nếu {defender.name} thua: <span className="font-bold">{gameState.basePenalty} ly</span></span>
          </div>
      </div>
  );

  // --- RENDER GAME ---

  // 1. LẬT THẺ
  if (roomData.minigameType === MinigameType.MEMORY) {
      // --- CHỐT AN TOÀN: Nếu chưa có dữ liệu bài thì hiện Loading ---
      // Điều này ngăn lỗi khi cố gắng map qua một mảng không tồn tại
      if (!gameState || !gameState.cards) {
         return <div className="text-white animate-pulse text-center mt-10">Đang chia bài...</div>;
      }
      // -----------------------------------------------------------

      const isMyTurn = gameState.currentTurn === userId;
      return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-rose-500">LẬT THẺ TỬ THẦN</h2>
            <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-600 mb-2">
                Lượt của: <span className={`font-bold ${isMyTurn ? 'text-green-400' : 'text-slate-300'}`}>{isMyTurn ? "BẠN" : roomData.players[gameState.currentTurn]?.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {/* Bây giờ gameState.cards chắc chắn tồn tại nên sẽ không lỗi nữa */}
                {gameState.cards.map((cardType: string, index: number) => {
                    const isFlipped = gameState.flipped.includes(index);
                    return (
                        <button key={index} onClick={() => handleFlipCard(index)} disabled={isFlipped || !isMyTurn || !!gameState.loser}
                            className={`w-24 h-32 rounded-xl border-4 transition-all duration-500 relative ${isFlipped ? (cardType === 'bomb' ? 'bg-rose-600 border-rose-400' : 'bg-emerald-600 border-emerald-400') : 'bg-slate-700 border-slate-500'}`}>
                            <div className="flex items-center justify-center h-full w-full">
                                {isFlipped ? (cardType === 'bomb' ? <Bomb size={40} className="text-white animate-bounce"/> : <Beer size={40} className="text-white"/>) : <span className="text-2xl font-bold text-slate-500">?</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
            {gameState.loser && <div className="text-2xl font-bold text-rose-500 animate-ping mt-4">BÙÙÙÙM!!! 💥</div>}
        </div>
      );
  }

  // 2. OẲN TÙ TÌ
  if (roomData.minigameType === MinigameType.RPS) {
    const myMove = roomData.players[userId]?.minigameMove;
    const opponentId = userId === challengerId ? defenderId : challengerId;
    const opponentHasMoved = !!roomData.players[opponentId]?.minigameMove;
    return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-indigo-400">OẲN TÙ TÌ</h2>
            <div className="flex justify-between w-full max-w-lg px-4 text-center">
                 <div><p className="font-bold text-rose-400">{challenger.name}</p>{challenger.minigameMove && <div className="mt-1 text-xl">✅</div>}</div>
                 <div className="text-2xl font-bungee">VS</div>
                 <div><p className="font-bold text-indigo-400">{defender.name}</p>{defender.minigameMove && <div className="mt-1 text-xl">✅</div>}</div>
            </div>
            {isPlayer ? (
                myMove ? <div className="text-xl text-yellow-400 animate-pulse mt-8">{opponentHasMoved ? "Đang tính..." : "Đang chờ đối thủ..."}</div> :
                <div className="grid grid-cols-3 gap-4 mt-8">
                    {['rock', 'paper', 'scissors'].map(m => (
                        <button key={m} onClick={() => sendMove(m)} className="w-20 h-20 bg-slate-800 rounded-full text-4xl border-4 border-slate-600 hover:bg-slate-700">
                            {m === 'rock' ? '✊' : m === 'paper' ? '✋' : '✌️'}
                        </button>
                    ))}
                </div>
            ) : <p className="text-slate-500">Đang xem thi đấu...</p>}
        </div>
    );
  }

  // 3. NHANH TAY LẸ MẮT (ĐÃ SỬA LOGIC CÔNG BẰNG)
  if (roomData.minigameType === MinigameType.FAST_HANDS) {
      // Biến quan trọng: Nút chỉ hiện khi Firebase báo canAttack = true
      const canClick = gameState.canAttack; 

      return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in w-full">
            {penaltyDisplay}
            <h2 className="text-3xl font-bungee text-yellow-500">NHANH TAY LẸ MẮT</h2>
            
            <div className="relative h-64 w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center">
                {isPlayer ? (
                    canClick ? (
                        // CHỈ HIỆN KHI HOST CHO PHÉP (Sau 3 giây)
                        <button 
                            onClick={() => sendMove(Date.now().toString())}
                            className="w-40 h-40 bg-red-600 rounded-full shadow-[0_0_60px_rgba(220,38,38,0.8)] animate-bounce active:scale-90 transition-transform flex items-center justify-center cursor-pointer hover:bg-red-500 border-4 border-white"
                        >
                            <Zap size={80} className="text-white fill-yellow-300" />
                        </button>
                    ) : (
                        // ĐANG ĐẾM NGƯỢC (Dùng localCountdown để hiển thị)
                        <div className="text-9xl font-bold text-white animate-ping font-bungee">
                            {localCountdown === 0 ? "GO!" : localCountdown}
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="text-slate-500 mb-4">Đang xem thi đấu...</div>
                        <div className="text-6xl font-bold text-slate-700">{localCountdown}</div>
                    </div>
                )}
            </div>
            
            {!canClick && <p className="text-slate-400 animate-pulse mt-4">Chuẩn bị...</p>}
            {canClick && <p className="text-rose-500 font-bold text-2xl animate-bounce mt-4">BẤM NGAY!!!</p>}
        </div>
      );
  }

  return <div className="text-center">Loading...</div>;
};

export default Minigames;
