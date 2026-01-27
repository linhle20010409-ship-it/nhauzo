
import React, { useState, useEffect, useRef } from 'react';
import { GameData, GameState, Player, GameMode, MinigameType } from '../types';
import { updateRoom } from '../firebaseService';
import Wheel from './Wheel';
import Minigames from './Minigames';
import { Beer, Target, Swords, HelpCircle, Trophy, AlertTriangle } from 'lucide-react';

interface GameBoardProps {
  roomData: GameData;
  userId: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ roomData, userId }) => {
  const isHost = roomData.hostId === userId;
  const isLoser = roomData.currentLoserId === userId;
  const [votingSelection, setVotingSelection] = useState<string | null>(null);
  const [deathSelection, setDeathSelection] = useState<number | null>(null);
  const [showMinigameSelector, setShowMinigameSelector] = useState(false);

  // Mode Logic: Death Number
  const selectDeathNumber = async (num: number) => {
    if (deathSelection !== null) return;
    setDeathSelection(num);
    const updates: any = {};
    updates[`players/${userId}/selectedNumber`] = num;
    
    // Fix: Explicitly cast to Player[] to avoid unknown type errors
    const players = Object.values(roomData.players) as Player[];
    const selectedCount = players.filter(p => p.selectedNumber !== undefined || p.id === userId).length;
    
    if (selectedCount === players.length) {
        // If everyone selected, find who hit the death number
        const hitPlayer = players.find(p => p.selectedNumber === roomData.deathNumber || (p.id === userId && num === roomData.deathNumber));
        if (hitPlayer) {
            updates.currentLoserId = hitPlayer.id;
            updates.state = GameState.DECIDING_PENALTY;
        } else {
            // Randomly pick one if no one hit it
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            updates.currentLoserId = randomPlayer.id;
            updates.state = GameState.DECIDING_PENALTY;
        }
    }
    await updateRoom(roomData.id, updates);
  };

  // Mode Logic: Voting
  const handleVote = async (targetId: string) => {
    if (votingSelection) return;
    setVotingSelection(targetId);
    const updates: any = {};
    const currentVotes = roomData.players[targetId].voteCount || 0;
    updates[`players/${targetId}/voteCount`] = currentVotes + 1;
    
    // Fix: Explicitly cast to Player[] to avoid unknown type errors
    const players = Object.values(roomData.players) as Player[];
    const totalVotes = players.reduce((sum, p) => sum + (p.voteCount || 0), 0) + 1;
    
    if (totalVotes === players.length) {
        let maxVotes = -1;
        let loserId = '';
        players.forEach(p => {
            const v = p.id === targetId ? currentVotes + 1 : (p.voteCount || 0);
            if (v > maxVotes) {
                maxVotes = v;
                loserId = p.id;
            }
        });
        updates.currentLoserId = loserId;
        updates.state = GameState.DECIDING_PENALTY;
    }
    await updateRoom(roomData.id, updates);
  };

  // Loser Decision: Penalty vs Duel
  const handleDecision = async (type: 'WHEEL' | 'DUEL') => {
    if (!isLoser) return;
    if (type === 'WHEEL') {
        await updateRoom(roomData.id, { state: GameState.SPINNING_PENALTY });
    } else {
        // Thay vì random ngay, ta mở menu cho người chơi chọn
        setShowMinigameSelector(true);
    }
  };

  // 2. Thêm hàm này ngay bên dưới handleDecision: Xử lý khi bấm chọn 1 minigame cụ thể
  const handleSelectMinigame = async (selectedGame: MinigameType) => {
    // Chọn đối thủ ngẫu nhiên từ những người còn lại
    // (Fix lỗi: Ép kiểu dữ liệu để tránh lỗi TypeScript)
    const players = Object.values(roomData.players) as Player[];
    const others = players.filter(p => p.id !== userId);
    
    // Nếu chơi 1 mình (test) thì lấy chính mình, nếu đông thì lấy người khác
    const opponent = others.length > 0 
        ? others[Math.floor(Math.random() * others.length)] 
        : players[0];

    await updateRoom(roomData.id, { 
        state: GameState.MINIGAME_DUEL,
        targetOpponentId: opponent.id,
        minigameType: selectedGame // <-- Truyền game đã chọn vào đây
    });
    
    // Tắt menu sau khi chọn xong
    setShowMinigameSelector(false);
  };
  const backToLobby = async () => {
      if (!isHost) return;
      // Reset all game states for players
      const updates: any = {
          state: GameState.LOBBY,
          currentLoserId: null,
          targetOpponentId: null,
          winnerId: null,
          winnerBeerAmount: null,
          deathNumber: null,
          minigameType: null
      };
      Object.keys(roomData.players).forEach(id => {
          updates[`players/${id}/voteCount`] = 0;
          updates[`players/${id}/selectedNumber`] = null;
      });
      await updateRoom(roomData.id, updates);
  };

  const renderPhase = () => {
    switch(roomData.state) {
        case GameState.PICKING_LOSER:
            if (roomData.mode === GameMode.RANDOM) {
                return (
                    <div className="flex flex-col items-center gap-8">
                        <h2 className="text-3xl font-bungee text-amber-500">Vòng quay định mệnh</h2>
                        <Wheel 
                            // Fix: Explicitly cast to Player[] for mapping
                            items={(Object.values(roomData.players) as Player[]).map(p => ({ label: p.name, value: p.id }))} 
                            onFinished={(winnerId) => isHost && updateRoom(roomData.id, { state: GameState.DECIDING_PENALTY, currentLoserId: winnerId })}
                            canSpin={isHost}
                        />
                        <p className="text-slate-400 italic">Chủ phòng nhấp vào vòng quay để tìm "nạn nhân"</p>
                    </div>
                );
            }
            if (roomData.mode === GameMode.DEATH_NUMBER) {
                return (
                    <div className="flex flex-col items-center gap-8 animate-in fade-in">
                        <h2 className="text-3xl font-bungee text-rose-500">Tìm số tử thần</h2>
                        <p className="text-slate-400">Chọn 1 số bí mật. Nếu trúng số đen, bạn sẽ là người thua!</p>
                        <div className="grid grid-cols-5 gap-3 max-w-md">
                            {Array.from({length: 20}, (_, i) => i + 1).map(n => (
                                <button 
                                    key={n}
                                    onClick={() => selectDeathNumber(n)}
                                    disabled={deathSelection !== null}
                                    className={`w-12 h-12 flex items-center justify-center rounded-xl font-bold transition-all border
                                        ${deathSelection === n ? 'bg-rose-600 border-rose-400 shadow-lg shadow-rose-600/50' : 'bg-slate-900 border-slate-700 hover:border-rose-500'}
                                        ${deathSelection !== null && deathSelection !== n ? 'opacity-50 grayscale' : ''}
                                    `}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            }
            if (roomData.mode === GameMode.VOTING) {
                return (
                    <div className="flex flex-col items-center gap-8 animate-in slide-in-from-bottom">
                        <h2 className="text-3xl font-bungee text-emerald-500">Ai là người đen nhất?</h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                            {/* Fix: Explicitly cast to Player[] for mapping */}
                            {(Object.values(roomData.players) as Player[]).map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => handleVote(p.id)}
                                    disabled={votingSelection !== null}
                                    className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-3
                                        ${votingSelection === p.id ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-900 border-slate-700 hover:border-emerald-500'}
                                    `}
                                >
                                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold">
                                        {p.name[0].toUpperCase()}
                                    </div>
                                    <span className="font-bold">{p.name}</span>
                                    <div className="text-xs font-bold bg-black/30 px-2 py-1 rounded-full">
                                        VOTES: {p.voteCount || 0}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            }
            return null;

        case GameState.DECIDING_PENALTY:
            const loser = roomData.players[roomData.currentLoserId!];
            return (
                <div className="flex flex-col items-center gap-10 animate-in zoom-in">
                    <div className="text-center space-y-4">
                        <div className="p-4 bg-rose-600 rounded-3xl inline-block shadow-[0_0_30px_rgba(225,29,72,0.5)]">
                             <AlertTriangle size={64} />
                        </div>
                        <h2 className="text-4xl font-bungee text-white">XIN CHIA BUỒN!</h2>
                        <p className="text-2xl font-bold text-rose-500 uppercase tracking-widest">{loser.name} LÀ NGƯỜI THUA</p>
                    </div>

                    {isLoser ? (
                        <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl">
                            <button 
                                onClick={() => handleDecision('WHEEL')}
                                className="group p-8 glass bg-slate-900/40 hover:bg-amber-600 border-amber-500/30 rounded-3xl transition-all text-center space-y-4"
                            >
                                <Target className="mx-auto text-amber-500 group-hover:text-white" size={48} />
                                <div className="space-y-1">
                                    <h3 className="font-bold text-xl">QUAY HÌNH PHẠT</h3>
                                    <p className="text-sm text-slate-400 group-hover:text-amber-100">Chấp nhận số phận, uống bao nhiêu tính bấy nhiêu.</p>
                                </div>
                            </button>
                            <button 
                                onClick={() => handleDecision('DUEL')}
                                className="group p-8 glass bg-slate-900/40 hover:bg-indigo-600 border-indigo-500/30 rounded-3xl transition-all text-center space-y-4"
                            >
                                <Swords className="mx-auto text-indigo-500 group-hover:text-white" size={48} />
                                <div className="space-y-1">
                                    <h3 className="font-bold text-xl">TỬ CHIẾN (SOLO)</h3>
                                    <p className="text-sm text-slate-400 group-hover:text-indigo-100">Chọn 1 người solo. Thua uống gấp đôi, thắng thoát nạn!</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="p-8 bg-slate-900/50 rounded-3xl border border-white/5 text-center">
                            <p className="text-slate-400 italic">Đang chờ <span className="text-white font-bold">{loser.name}</span> lựa chọn...</p>
                        </div>
                    )}
                </div>
            );

        case GameState.SPINNING_PENALTY:
return (
                <div className="flex flex-col items-center gap-8 animate-in fade-in">
                    <h2 className="text-3xl font-bungee text-amber-500">Vòng quay hình phạt</h2>
                    
                    {/* Hiển thị thông báo ai đang quay */}
                    {!isLoser && (
                         <p className="text-slate-400 animate-pulse">
                            ⏳ Đang chờ <span className="text-white font-bold">{roomData.players[roomData.currentLoserId!]?.name}</span> tự tay quay...
                         </p>
                    )}

                    <Wheel 
                        items={roomData.penalties.map((p, i) => ({ label: `${p.text} (${p.amount} ly)`, value: i.toString() }))}
                        onFinished={(idx) => {
                            // 👇 SỬA Ở ĐÂY: Nếu là Chủ phòng HOẶC Người thua thì đều gửi lệnh cập nhật được
                            if (canSpinPenalty) {
                                const p = roomData.penalties[parseInt(idx)];
                                updateRoom(roomData.id, { 
                                    state: GameState.RESULT,
                                    winnerId: roomData.currentLoserId,
                                    winnerBeerAmount: p.amount
                                });
                            }
                        }}
                        // 👇 SỬA Ở ĐÂY: Truyền biến đã sửa vào
                        canSpin={canSpinPenalty} 
                    />
                </div>
            );

        case GameState.MINIGAME_DUEL:
            return <Minigames roomData={roomData} userId={userId} />;

        case GameState.RESULT:
            const resultPlayer = roomData.players[roomData.winnerId!];
            const isMe = roomData.winnerId === userId;
            return (
                <div className="flex flex-col items-center gap-10 animate-in zoom-in">
                    <div className="text-center space-y-4">
                        <div className={`p-6 rounded-full inline-block shadow-2xl ${isMe ? 'bg-amber-600 shadow-amber-600/50' : 'bg-indigo-600 shadow-indigo-600/50'}`}>
                             <Beer size={80} className="text-white" />
                        </div>
                        <h2 className="text-5xl font-bungee text-white">DZÔÔÔ!</h2>
                        <div className="space-y-2">
                             <p className="text-2xl font-bold">{isMe ? 'BẠN PHẢI UỐNG' : `${resultPlayer.name} PHẢI UỐNG`}</p>
                             <p className="text-7xl font-bungee text-amber-500">{roomData.winnerBeerAmount} LY</p>
                        </div>
                    </div>
                    
                    {isHost && (
                        <button 
                            onClick={backToLobby}
                            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all shadow-lg hover:scale-105"
                        >
                            TIẾP TỤC CUỘC VUI
                        </button>
                    )}
                </div>
            );

        default:
            return null;
    }
  };

  return (
    <div className="w-full">
      {renderPhase()}
    </div>
  );
};

export default GameBoard;
