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

  // --- LOGIC TRỌNG TÀI (Host sẽ chạy đoạn này) ---
  useEffect(() => {
    if (!isHost) return; // Chỉ chủ phòng mới được tính điểm để tránh lỗi đè dữ liệu

    const p1Move = challenger?.minigameMove;
    const p2Move = defender?.minigameMove;

    // 1. GAME OẲN TÙ TÌ (Cả 2 phải cùng ra)
    if (roomData.minigameType === MinigameType.RPS) {
      if (p1Move && p2Move) {
        // Cả 2 đã chọn xong -> Tính kết quả
        let winnerId: string | null = null;
        
        if (p1Move === p2Move) {
          // HÒA -> Reset lượt chơi
          setTimeout(() => {
             // Xóa nước đi để chơi lại
             const updates: any = {};
             updates[`players/${challengerId}/minigameMove`] = null;
             updates[`players/${defenderId}/minigameMove`] = null;
             updateRoom(roomData.id, updates);
          }, 2000); // Chờ 2s cho người chơi xem mình vừa ra gì rồi mới reset
          return;
        }

        // Logic thắng thua: R (Búa) > S (Kéo) > P (Bao) > R
        if (
          (p1Move === 'rock' && p2Move === 'scissors') ||
          (p1Move === 'scissors' && p2Move === 'paper') ||
          (p1Move === 'paper' && p2Move === 'rock')
        ) {
          winnerId = challengerId; // Người thách đấu thắng
        } else {
          winnerId = defenderId; // Người bị thách thắng
        }

        // Cập nhật kết quả cuối cùng
        finishGame(winnerId);
      }
    }

    // 2. GAME NHANH TAY (Ai bấm trước người đó thắng)
    if (roomData.minigameType === MinigameType.FAST_HANDS) {
       // Chỉ cần 1 người bấm là thắng luôn
       if (p1Move) finishGame(challengerId);
       else if (p2Move) finishGame(defenderId);
    }

  }, [roomData, isHost]); // Chạy lại mỗi khi data phòng thay đổi

  // Hàm kết thúc game và chuyển sang màn hình phạt bia
  const finishGame = (winnerId: string) => {
    const isChallengerWon = winnerId === challengerId;
    
    // Nếu Người thách đấu thắng: Đối thủ uống 100% (hoặc số lượng tùy chỉnh)
    // Nếu Người thách đấu thua: Phải uống gấp đôi (Phạt tội "gáy sớm")
    const loserId = isChallengerWon ? defenderId : challengerId;
    const amount = isChallengerWon ? 1 : 2; // Ví dụ: Thua thường 1 ly, Thua ngược 2 ly

    updateRoom(roomData.id, {
        state: GameState.RESULT,
        winnerId: loserId, // Lưu ý: Biến này tên là winnerId nhưng logic hiển thị ở GameBoard đang dùng nó như là "Người phải uống" (Loser)
        winnerBeerAmount: amount
    });
  };

  // --- GỬI HÀNH ĐỘNG ---
  const sendMove = (move: string) => {
    if (!isPlayer) return;
    // Gửi nước đi lên Firebase
    updateRoom(roomData.id, {
        [`players/${userId}/minigameMove`]: move
    });
  };

  // --- GIAO DIỆN ---
  
  // 1. Giao diện Oẳn Tù Tì
  if (roomData.minigameType === MinigameType.RPS) {
    const myMove = roomData.players[userId]?.minigameMove;
    // Kiểm tra xem đối phương đã chọn chưa (để hiện trạng thái chờ)
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

  // 2. Giao diện Nhanh Tay (Ai bấm trước thắng)
  if (roomData.minigameType === MinigameType.FAST_HANDS) {
      return (
        <div className="flex flex-col items-center gap-8 animate-in fade-in w-full">
            <h2 className="text-3xl font-bungee text-yellow-500">NHANH TAY LẸ MẮT</h2>
            <p className="text-slate-300">Bấm nút bên dưới ngay khi nó hiện lên!</p>
            
            <div className="relative h-64 w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center">
                {isPlayer ? (
                    <button 
                        onClick={() => sendMove(Date.now().toString())}
                        className="w-32 h-32 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce active:scale-90 transition-transform flex items-center justify-center"
                    >
                        <Zap size={48} className="text-white" />
                    </button>
                ) : (
                    <div className="text-slate-500">Đang xem 2 đấu thủ thi đấu...</div>
                )}
            </div>
        </div>
      );
  }

  // Fallback cho game chưa làm
  return <div className="text-center text-slate-400">Game này đang phát triển...</div>;
};

export default Minigames;
