
import React, { useState, useEffect } from 'react';
import { GameData, GameState, MinigameType } from '../types';
import { updateRoom } from '../firebaseService';
import { Swords, Zap, Brain, Hand, HelpCircle } from 'lucide-react';

interface MinigamesProps {
  roomData: GameData;
  userId: string;
}

const Minigames: React.FC<MinigamesProps> = ({ roomData, userId }) => {
  const isHost = roomData.hostId === userId;
  const isLoser = roomData.currentLoserId === userId;
  const isOpponent = roomData.targetOpponentId === userId;
  const isParticipant = isLoser || isOpponent;
  
  const [selection, setSelection] = useState<any>(null);
  const [status, setStatus] = useState('Đang bắt đầu...');
  const [showLaw, setShowLaw] = useState(false);

  // RPS State
  const [rpsChoice, setRpsChoice] = useState<string | null>(null);

  // Fast Hands State
  const [fastTarget, setFastTarget] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (roomData.minigameType === MinigameType.FAST_HANDS && isParticipant) {
        const timer = setTimeout(() => {
            setFastTarget(true);
            setStartTime(Date.now());
        }, 2000 + Math.random() * 3000);
        return () => clearTimeout(timer);
    }
  }, [roomData.minigameType, isParticipant]);

  const handleRps = async (choice: string) => {
      if (rpsChoice || !isParticipant) return;
      setRpsChoice(choice);
      const updates: any = {};
      updates[`players/${userId}/minigameAction`] = choice;
      await updateRoom(roomData.id, updates);
      
      // Check if both played
      const loser = roomData.players[roomData.currentLoserId!];
      const opponent = roomData.players[roomData.targetOpponentId!];
      if (loser.minigameAction && opponent.minigameAction) {
          if (!isHost) return;
          // Determine winner
          const l = loser.minigameAction;
          const o = opponent.minigameAction;
          let winnerId = '';
          if (l === o) { // Tie - redo (not implemented for simplicity, just pick one)
            winnerId = Math.random() > 0.5 ? loser.id : opponent.id;
          } else if ((l === 'Búa' && o === 'Kéo') || (l === 'Kéo' && o === 'Giấy') || (l === 'Giấy' && o === 'Búa')) {
            winnerId = opponent.id; // Loser wins the duel -> Opponent drinks
          } else {
            winnerId = loser.id; // Opponent wins duel -> Loser drinks
          }
          finishDuel(winnerId);
      }
  };

  const handleFastClick = async () => {
      if (!fastTarget || !isParticipant) return;
      const reaction = Date.now() - startTime;
      const winnerId = isLoser ? roomData.targetOpponentId : roomData.currentLoserId; // The one who clicked is the winner of the duel
      finishDuel(winnerId!);
  };

  const finishDuel = async (drinkerId: string) => {
      if (!isHost) return;
      // Logic: 
      // If Loser (Challenger) loses duel (drinkerId === roomData.currentLoserId), double penalty (2 ly)
      // If Opponent (Target) loses duel (drinkerId === roomData.targetOpponentId), original penalty (1 ly)
      const isChallengerLost = drinkerId === roomData.currentLoserId;
      const amount = isChallengerLost ? 2 : 1;
      
      await updateRoom(roomData.id, {
          state: GameState.RESULT,
          winnerId: drinkerId,
          winnerBeerAmount: amount
      });
  };

  const renderGame = () => {
      switch(roomData.minigameType) {
          case MinigameType.RPS:
              return (
                  <div className="space-y-8 text-center">
                      <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
                        <Hand className="text-indigo-400" /> Oẳn tù tì
                      </h3>
                      {isParticipant ? (
                          <div className="grid grid-cols-3 gap-4">
                              {['Búa', 'Bao', 'Kéo'].map(choice => (
                                  <button 
                                    key={choice}
                                    onClick={() => handleRps(choice)}
                                    className={`p-6 rounded-2xl border-2 transition-all font-bold text-lg
                                        ${rpsChoice === choice ? 'bg-indigo-600 border-white' : 'bg-slate-900 border-indigo-500/50 hover:bg-slate-800'}
                                    `}
                                  >
                                      {choice}
                                  </button>
                              ))}
                          </div>
                      ) : (
                          <p className="text-slate-400">Cuộc đấu đang diễn ra giữa {roomData.players[roomData.currentLoserId!].name} và {roomData.players[roomData.targetOpponentId!].name}</p>
                      )}
                  </div>
              );
          case MinigameType.FAST_HANDS:
              return (
                  <div className="space-y-8 text-center">
                       <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
                        <Zap className="text-yellow-400" /> Nhanh tay lẹ mắt
                      </h3>
                      {isParticipant ? (
                          <button 
                            onClick={handleFastClick}
                            className={`w-full aspect-video rounded-3xl border-4 transition-all flex items-center justify-center text-3xl font-bungee
                                ${fastTarget ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.4)]' : 'bg-rose-600 border-rose-400 cursor-not-allowed'}
                            `}
                          >
                              {fastTarget ? 'BẤM NGAY!!!' : 'CHỜ ĐÃ...'}
                          </button>
                      ) : (
                        <p className="text-slate-400 italic">Đang chờ 2 đối thủ so găng tốc độ...</p>
                      )}
                  </div>
              );
          case MinigameType.MEMORY:
              return (
                  <div className="space-y-4 text-center">
                       <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
                        <Brain className="text-purple-400" /> Lật thẻ may mắn
                      </h3>
                      <p className="text-slate-400">Hệ thống đang bốc thăm người thắng...</p>
                      {isHost && (
                          <button 
                            onClick={() => finishDuel(Math.random() > 0.5 ? roomData.currentLoserId! : roomData.targetOpponentId!)}
                            className="px-6 py-2 bg-purple-600 rounded-xl"
                          >
                              KẾT QUẢ NGẪU NHIÊN
                          </button>
                      )}
                  </div>
              )
          default: return null;
      }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in">
        <div className="glass p-8 rounded-3xl space-y-6 bg-gradient-to-tr from-slate-900 to-indigo-900/40">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <Swords className="text-indigo-400" size={32} />
                <h2 className="text-2xl font-bungee">TỬ CHIẾN</h2>
                <button 
                    onClick={() => setShowLaw(!showLaw)}
                    className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                >
                    <HelpCircle size={20} />
                </button>
            </div>

            {showLaw && (
                <div className="p-4 bg-black/40 rounded-2xl text-xs space-y-2 border border-white/5 animate-in slide-in-from-top">
                    <p className="font-bold text-amber-500">LUẬT CHƠI:</p>
                    <ul className="list-disc pl-4 text-slate-300">
                        <li>Kẻ thua cuộc ban đầu là <b>Người thách đấu</b>.</li>
                        <li>Người thách đấu thắng: Đối thủ uống <b>1 LY</b>.</li>
                        <li>Người thách đấu thua: Phải uống gấp đôi (<b>2 LY</b>).</li>
                    </ul>
                </div>
            )}

            <div className="flex items-center justify-around py-4">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-rose-600 rounded-full flex items-center justify-center font-bold border-4 border-rose-400">VS</div>
                    <p className="font-bold text-rose-500">{roomData.players[roomData.currentLoserId!].name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Thách đấu</p>
                </div>
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center font-bold border-4 border-slate-600">?</div>
                    <p className="font-bold">{roomData.players[roomData.targetOpponentId!].name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Bị chọn</p>
                </div>
            </div>

            {renderGame()}
        </div>
    </div>
  );
};

export default Minigames;
