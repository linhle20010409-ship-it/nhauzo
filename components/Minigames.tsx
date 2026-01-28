import React, { useEffect, useState } from 'react';
import { GameData, GameState, MinigameType, Player } from '../types';
import { updateRoom } from '../firebaseService';
import { Hand, Zap, Brain, Timer } from 'lucide-react';

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

  // State cho đếm ngược (Dành riêng cho game Nhanh Tay)
  const [countdown, setCountdown] = useState<number | null>(null);

  // --- LOGIC ĐẾM NGƯỢC (Chạy khi component được mount) ---
  useEffect(() => {
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
        setCountdown(3); // Bắt đầu đếm từ 3
        
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev === 1) {
                    clearInterval(timer);
                    return 0; // 0 nghĩa là "GO!"
                }
                // Nếu prev là null hoặc 0 thì giữ nguyên, ngược lại giảm 1
                return (prev !== null && prev > 0) ? prev - 1 : 0; 
            });
        }, 1000);

        return () => clearInterval(timer);
    }
  }, [roomData.minigameType]);

  // --- LOGIC TRỌNG TÀI (Host sẽ chạy đoạn này) ---
  useEffect(() => {
    if (!isHost) return; 

    const p1Move = challenger?.minigameMove;
    const p2Move = defender?.minigameMove;

    // 1. GAME OẲN TÙ TÌ (Cả 2 phải cùng ra)
    if (roomData.minigameType === MinigameType.RPS) {
      if (p1Move && p2Move) {
        let winnerId: string | null = null;
        
        if (p1Move === p2Move) {
          // HÒA -> Reset lượt chơi sau 2s
          setTimeout(() => {
             const updates: any = {};
             updates[`players/${challengerId}/minigameMove`] = null;
             updates[`players/${defenderId}/minigameMove`] = null;
             updateRoom(roomData.id, updates);
          }, 2000);
          return;
        }

        // Logic: Búa (rock) > Kéo (scissors) > Bao (paper) > Búa
        if (
          (p1Move === 'rock' && p2Move === 'scissors') ||
          (p1Move === 'scissors' && p2Move === 'paper') ||
          (p1Move === 'paper' && p2Move === 'rock')
        ) {
          winnerId = challengerId;
        } else {
          winnerId = defenderId;
        }
        finishGame(winnerId);
      }
    }

    // 2. GAME NHANH TAY (Ai bấm trước người đó thắng)
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
       // Chỉ cần 1 người bấm (có dữ liệu move) là xử thắng luôn
       if (p1Move) finishGame(challengerId);
       else if (p2Move) finishGame(defenderId);
    }

  }, [roomData, isHost, challenger?.minigameMove, defender?.minigameMove]);

  // Hàm kết thúc game
  const finishGame = (winnerId: string) => {
    const isChallengerWon = winnerId === challengerId;
    const loserId = isChallengerWon ? defenderId : challengerId;
    // Thua thì uống gấp đôi (2 ly), Thua "kèo dưới" thì uống 1 ly (tùy chỉnh)
    const amount = 1; 

    updateRoom(roomData.id, {
        state: GameState.RESULT,
        winnerId: loserId, 
        winnerBeerAmount: amount
    });
  };

  // --- GỬI HÀNH ĐỘNG ---
  const sendMove = (move: string) => {
    if (!isPlayer) return;
    updateRoom(roomData.id, {
        [`players/${userId}/minigameMove`]: move
    });
  };

  // --- GIAO DIỆN ---
  
  // 1. Giao diện Oẳn Tù Tì
  if (roomData.minigameType === MinigameType.RPS) {
    const myMove = roomData.players[userId]?.minigameMove;
    const opponentId = userId === challengerId ? defenderId : challengerId;
    const opponentHasMoved = !!roomData.players[opponentId]?.minigameMove;

    return (
        <div className="flex flex-col items-center gap-8 animate-in fade-in w-full">
            <h2 className="text-3xl font-bungee text-indigo-400">OẲN TÙ TÌ</h2>
            <div className="flex justify-between w-full max-w-lg px-4">
                 <div className="text-center">
                    <p className="font-bold text-rose-400">{challenger.name}</p>
                    <p className="text-sm text-slate-400">(Thách đấu)</p>
                    {challenger.minigameMove && <div className="mt-2 text-2xl">✅ Đã chọn</div>}
                 </div>
                 <div className="text-4xl font-bungee">VS</div>
                 <div className="text-center">
                    <p className="font-bold text-indigo-400">{defender.name}</p>
                    <p className="text-sm text-slate-400">(Phòng thủ)</p>
                    {defender.minigameMove && <div className="mt-2 text-2xl">✅ Đã chọn</div>}
                 </div>
            </div>

            {isPlayer ? (
                myMove ? (
                    <div className="text-xl text-yellow-400 animate-pulse mt-8">
                        {opponentHasMoved ? "Đang tính kết quả..." : "Đang chờ đối thủ..."}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <button onClick={() => sendMove('rock')} className="w-24 h-24 bg-slate-800 rounded-full text-5xl hover:bg-slate-700 hover:scale-110 transition-all border-4 border-slate-600">✊</button>
                        <button onClick={() => sendMove('paper')} className="w-24 h-24 bg-slate-800 rounded-full text-5xl hover:bg-slate-700 hover:scale-110 transition-all border-4 border-slate-600">✋</button>
                        <button onClick={() => sendMove('scissors')} className="w-24 h-24 bg-slate-800 rounded-full text-5xl hover:bg-slate-700 hover:scale-110 transition-all border-4 border-slate-600">✌️</button>
                    </div>
                )
            ) : (
                <p className="text-slate-500 mt-10">Khán giả vui lòng trật tự...</p>
            )}
        </div>
    );
  }

  // 2. Giao diện Nhanh Tay (Đã thêm đếm ngược)
  if (roomData.minigameType === MinigameType.FAST_HANDS) {
      return (
        <div className="flex flex-col items-center gap-8 animate-in fade-in w-full">
            <h2 className="text-3xl font-bungee text-yellow-500">NHANH TAY LẸ MẮT</h2>
            
            <div className="relative h-64 w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center">
                {isPlayer ? (
                    // Logic hiển thị: Nếu countdown > 0 thì hiện số, bằng 0 thì hiện nút
                    countdown !== null && countdown > 0 ? (
                        <div className="text-9xl font-bold text-white animate-ping">
                            {countdown}
                        </div>
                    ) : (
                        <button 
                            onClick={() => sendMove(Date.now().toString())}
                            className="w-32 h-32 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce active:scale-90 transition-transform flex items-center justify-center cursor-pointer"
                        >
                            <Zap size={64} className="text-white fill-yellow-300" />
                        </button>
                    )
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="text-slate-500 mb-4">Đang xem thi đấu...</div>
                        {countdown !== null && countdown > 0 && (
                             <div className="text-6xl font-bold text-slate-700">{countdown}</div>
                        )}
                    </div>
                )}
            </div>
            
            {countdown !== null && countdown > 0 && (
                <p className="text-slate-400 animate-pulse">Chuẩn bị...</p>
            )}
            {countdown === 0 && (
                <p className="text-rose-500 font-bold text-xl animate-bounce">BẤM NGAY!!!</p>
            )}
        </div>
      );
  }

  return <div className="text-center text-slate-400">Game này đang phát triển...</div>;
};

export default Minigames;
