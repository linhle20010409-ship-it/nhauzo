import React, { useState } from 'react';
import { GameData, GameState, Player, GameMode, MinigameType } from '../types';
import { updateRoom } from '../firebaseService';
import Wheel from './Wheel';
import Minigames from './Minigames';
import { Beer, Target, Swords, AlertTriangle, Bomb, Crown, UserCheck, Vote } from 'lucide-react';

interface GameBoardProps {
  roomData: GameData;
  userId: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ roomData, userId }) => {
  const isHost = roomData.hostId === userId;
  const isLoser = roomData.currentLoserId === userId;
  const controllerId = roomData.nextControllerId || roomData.hostId;
  const isController = userId === controllerId;
  const controllerName = roomData.players[controllerId]?.name || "Chủ phòng";

  const [votingSelection, setVotingSelection] = useState<string | null>(null);
  const [deathSelection, setDeathSelection] = useState<number | null>(null);
  const [showOpponentSelector, setShowOpponentSelector] = useState(false);
  const [showMinigameSelector, setShowMinigameSelector] = useState(false);
  const [tempOpponentId, setTempOpponentId] = useState<string | null>(null);

  // --- LOGIC GAME MỚI ---
  const startSynchronizedSpin = async (type: 'LOSER' | 'PENALTY') => {
    if (!isController && !isHost) return;

    if (type === 'LOSER') {
        const players = Object.values(roomData.players) as Player[];
        const randomIndex = Math.floor(Math.random() * players.length);
        const winnerId = players[randomIndex].id;

        await updateRoom(roomData.id, {
            state: GameState.PICKING_LOSER,
            spinData: { isSpinning: true, winnerIndex: randomIndex, winnerId: winnerId, startTime: Date.now() }
        });
    } else if (type === 'PENALTY') {
        const penaltyIndex = Math.floor(Math.random() * roomData.penalties.length);
        await updateRoom(roomData.id, {
            state: GameState.SPINNING_PENALTY,
            spinData: { isSpinning: true, winnerIndex: penaltyIndex, winnerId: roomData.currentLoserId, startTime: Date.now() }
        });
    }
  };

  const handleSpinFinished = async () => {
      if (isHost && roomData.spinData?.isSpinning) {
          setTimeout(async () => {
              if (roomData.state === GameState.PICKING_LOSER) {
                  await updateRoom(roomData.id, { state: GameState.DECIDING_PENALTY, currentLoserId: roomData.spinData.winnerId, spinData: null });
              } else if (roomData.state === GameState.SPINNING_PENALTY) {
                  const p = roomData.penalties[roomData.spinData.winnerIndex];
                  const nextController = roomData.currentLoserId;
                  await updateRoom(roomData.id, { state: GameState.RESULT, winnerId: roomData.currentLoserId, winnerBeerAmount: p.amount, spinData: null, nextControllerId: nextController });
              }
          }, 1000);
      }
  };

  const backToLobby = async () => {
      if (!isHost) return;
      const nextController = roomData.nextControllerId || roomData.winnerId || roomData.hostId;
      const updates: any = {
          state: GameState.LOBBY,
          currentLoserId: null, targetOpponentId: null, winnerId: null, winnerBeerAmount: null,
          deathNumber: null, minigameType: null, spinData: null, minigameState: null,
          nextControllerId: nextController 
      };
      Object.keys(roomData.players).forEach(id => {
          updates[`players/${id}/voteCount`] = 0;
          updates[`players/${id}/selectedNumber`] = null;
          updates[`players/${id}/minigameMove`] = null; 
      });
      await updateRoom(roomData.id, updates);
  };

  // --- LOGIC CŨ ---
  const selectDeathNumber = async (num: number) => {
    if (deathSelection !== null) return;
    setDeathSelection(num);
    const updates: any = {};
    updates[`players/${userId}/selectedNumber`] = num;
    const players = Object.values(roomData.players) as Player[];
    const selectedCount = players.filter(p => p.selectedNumber !== undefined || p.id === userId).length;
    
    if (selectedCount === players.length) {
        const hitPlayer = players.find(p => p.selectedNumber === roomData.deathNumber || (p.id === userId && num === roomData.deathNumber));
        let loserId = hitPlayer ? hitPlayer.id : players[Math.floor(Math.random() * players.length)].id;
        updates.currentLoserId = loserId;
        updates.nextControllerId = loserId; 
        updates.state = GameState.DECIDING_PENALTY;
    }
    await updateRoom(roomData.id, updates);
  };

  const handleVote = async (targetId: string) => {
    if (votingSelection) return;
    setVotingSelection(targetId);
    const updates: any = {};
    const currentVotes = roomData.players[targetId].voteCount || 0;
    updates[`players/${targetId}/voteCount`] = currentVotes + 1;
    
    const players = Object.values(roomData.players) as Player[];
    const totalVotes = players.reduce((sum, p) => sum + (p.voteCount || 0), 0) + 1;
    
    if (totalVotes === players.length) {
        let maxVotes = -1;
        let loserId = '';
        players.forEach(p => {
            const v = p.id === targetId ? currentVotes + 1 : (p.voteCount || 0);
            if (v > maxVotes) { maxVotes = v; loserId = p.id; }
        });
        updates.currentLoserId = loserId;
        updates.nextControllerId = loserId; 
        updates.state = GameState.DECIDING_PENALTY;
    }
    await updateRoom(roomData.id, updates);
  };

  const handleDecision = async (type: 'WHEEL' | 'DUEL') => {
    if (!isLoser) return;
    if (type === 'WHEEL') await updateRoom(roomData.id, { state: GameState.SPINNING_PENALTY });
    else setShowOpponentSelector(true);
  };

  const handleChooseOpponent = (opponentId: string) => {
      setTempOpponentId(opponentId);
      setShowOpponentSelector(false);
      setShowMinigameSelector(true);
  };

  const handleSelectMinigame = async (selectedGame: MinigameType) => {
    let targetId = tempOpponentId;
    if (!targetId) {
        const players = Object.values(roomData.players) as Player[];
        const others = players.filter(p => p.id !== userId);
        targetId = others.length > 0 ? others[Math.floor(Math.random() * others.length)].id : players[0].id;
    }
    await updateRoom(roomData.id, { state: GameState.MINIGAME_DUEL, targetOpponentId: targetId, minigameType: selectedGame });
    setShowMinigameSelector(false);
    setTempOpponentId(null);
  };

  // --- RENDER ---
  const renderPhase = () => {
    switch(roomData.state) {
        case GameState.PICKING_LOSER:
            if (roomData.mode === GameMode.RANDOM) {
                const spinData = roomData.spinData || { isSpinning: false, winnerIndex: null };
                const canSpin = isController || isHost; 
                return (
                    <div className="flex flex-col items-center gap-8">
                        <div className="flex items-center gap-2 text-amber-500"><Crown size={32} /><h2 className="text-3xl font-bungee">Vòng quay định mệnh</h2></div>
                        {!spinData.isSpinning && <div className="flex flex-col items-center gap-1"><p className="text-sm text-slate-400">Người cầm cái:</p><div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full border border-amber-500/50"><UserCheck size={18} className="text-amber-400" /><span className="font-bold text-amber-400 text-lg">{controllerName}</span></div></div>}
                        <div className="relative">
                            <Wheel items={(Object.values(roomData.players) as Player[]).map(p => ({ label: p.name, value: p.id }))} isSpinning={spinData.isSpinning} winnerIndex={spinData.winnerIndex} onFinished={handleSpinFinished} />
                            {canSpin && !spinData.isSpinning && <button onClick={() => startSynchronizedSpin('LOSER')} className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-4 border-white shadow-xl text-white font-bold text-xl transition-all z-20 ${isController ? 'bg-amber-500 hover:bg-amber-600 hover:scale-110 animate-pulse' : 'bg-slate-500 hover:bg-slate-600'}`}>{isController ? "QUAY" : "HỘ"}</button>}
                        </div>
                        {spinData.isSpinning ? <p className="text-rose-500 font-bold animate-pulse text-xl">ĐANG TÌM NẠN NHÂN...</p> : !isController && <p className="text-slate-500 italic">Đợi {controllerName} bấm quay...</p>}
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
                                <button key={n} onClick={() => selectDeathNumber(n)} disabled={deathSelection !== null} className={`w-12 h-12 flex items-center justify-center rounded-xl font-bold transition-all border ${deathSelection === n ? 'bg-rose-600 border-rose-400 shadow-lg shadow-rose-600/50' : 'bg-slate-900 border-slate-700 hover:border-rose-500'} ${deathSelection !== null && deathSelection !== n ? 'opacity-50 grayscale' : ''}`}>{n}</button>
                            ))}
                        </div>
                    </div>
                );
            }
            if (roomData.mode === GameMode.VOTING) {
                const totalVotes = Object.values(roomData.players).reduce((acc, p) => acc + (p.voteCount || 0), 0);
                const totalPlayers = Object.keys(roomData.players).length;
                return (
                    <div className="flex flex-col items-center gap-8 animate-in slide-in-from-bottom">
                        <div className="text-center"><h2 className="text-3xl font-bungee text-emerald-500">Bỏ phiếu kín</h2><p className="text-slate-400 text-sm mt-1">Đã bỏ phiếu: <span className="text-white font-bold">{totalVotes}/{totalPlayers}</span></p></div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                            {(Object.values(roomData.players) as Player[]).map(p => (
                                <button key={p.id} onClick={() => handleVote(p.id)} disabled={votingSelection !== null} className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-3 relative ${votingSelection === p.id ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-900 border-slate-700 hover:border-emerald-500'}`}>
                                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold">{p.name[0].toUpperCase()}</div>
                                    <span className="font-bold">{p.name}</span>
                                    <div className="text-xs font-bold bg-black/30 px-3 py-1 rounded-full text-slate-400 flex items-center gap-1"><Vote size={12}/> ???</div>
                                </button>
                            ))}
                        </div>
                        {votingSelection && <p className="text-emerald-400 animate-pulse">Đang chờ người khác...</p>}
                    </div>
                );
            }
            return null;

        case GameState.DECIDING_PENALTY:
            const loser = roomData.players[roomData.currentLoserId!];
            return (
                <div className="flex flex-col items-center gap-10 animate-in zoom-in">
                    <div className="text-center space-y-4">
                        <div className="p-4 bg-rose-600 rounded-3xl inline-block shadow-[0_0_30px_rgba(225,29,72,0.5)]"><AlertTriangle size={64} /></div>
                        <h2 className="text-4xl font-bungee text-white">XIN CHIA BUỒN!</h2>
                        <p className="text-2xl font-bold text-rose-500 uppercase tracking-widest">{loser.name} LÀ NGƯỜI THUA</p>
                        {roomData.mode === GameMode.VOTING && (
                            <div className="mt-4 bg-slate-900/80 p-4 rounded-xl border border-white/10 max-w-sm mx-auto">
                                <h4 className="text-emerald-400 font-bold mb-2 uppercase text-sm border-b border-white/10 pb-2">Kết quả bỏ phiếu</h4>
                                <div className="space-y-2">{(Object.values(roomData.players) as Player[]).sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0)).map(p => (<div key={p.id} className="flex justify-between items-center text-sm"><span>{p.name}</span><span className="font-bold text-white bg-slate-700 px-2 rounded">{p.voteCount || 0} phiếu</span></div>))}</div>
                            </div>
                        )}
                    </div>
                    {isLoser ? (
                        showOpponentSelector ? (
                            <div className="flex flex-col gap-4 w-full max-w-md animate-in slide-in-from-right">
                                <h3 className="text-xl font-bold text-rose-400 text-center mb-2 uppercase">Chọn đối thủ muốn "xử"</h3>
                                <div className="grid grid-cols-2 gap-3">{(Object.values(roomData.players) as Player[]).filter(p => p.id !== userId).map(p => (<button key={p.id} onClick={() => handleChooseOpponent(p.id)} className="p-4 bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-500 rounded-2xl flex flex-col items-center gap-2 transition-all"><div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xl">{p.name.charAt(0).toUpperCase()}</div><span className="font-bold text-white truncate w-full text-center">{p.name}</span></button>))}</div>
                                <button onClick={() => setShowOpponentSelector(false)} className="mt-4 text-slate-500 hover:text-white text-sm underline text-center">Quay lại</button>
                            </div>
                        ) : showMinigameSelector ? (
                            <div className="flex flex-col gap-4 w-full max-w-md animate-in slide-in-from-right">
                                <h3 className="text-xl font-bold text-indigo-300 text-center mb-2">CHỌN MÔN THI ĐẤU</h3>
                                <button onClick={() => handleSelectMinigame(MinigameType.RPS)} className="p-4 bg-slate-800 hover:bg-indigo-600 border border-indigo-500/50 rounded-2xl flex items-center gap-4 transition-all"><span className="text-3xl">✌️</span><div className="text-left"><div className="font-bold text-white">Oẳn Tù Tì</div><div className="text-xs text-slate-400">Đấu trí căng não</div></div></button>
                                <button onClick={() => handleSelectMinigame(MinigameType.FAST_HANDS)} className="p-4 bg-slate-800 hover:bg-rose-600 border border-rose-500/50 rounded-2xl flex items-center gap-4 transition-all"><span className="text-3xl">⚡</span><div className="text-left"><div className="font-bold text-white">Nhanh Tay Lẹ Mắt</div><div className="text-xs text-slate-400">Ai nhanh hơn thắng</div></div></button>
                                <button onClick={() => handleSelectMinigame(MinigameType.MEMORY)} className="p-4 bg-slate-800 hover:bg-emerald-600 border border-emerald-500/50 rounded-2xl flex items-center gap-4 transition-all"><span className="text-3xl"><Bomb className="text-rose-500 inline" size={32}/></span><div className="text-left"><div className="font-bold text-white">Lật Thẻ Tử Thần</div><div className="text-xs text-slate-400">Né bom hoặc uống!</div></div></button>
                                <button onClick={() => handleSelectMinigame(MinigameType.TAP_WAR)} className="p-4 bg-slate-800 hover:bg-orange-600 border border-orange-500/50 rounded-2xl flex items-center gap-4 transition-all"><span className="text-3xl">🥊</span><div className="text-left"><div className="font-bold text-white">Loạn Đả Màn Hình</div><div className="text-xs text-slate-400">Bấm gãy tay thì thôi!</div></div></button>
                                <button onClick={() => { setShowMinigameSelector(false); setShowOpponentSelector(true); }} className="mt-2 text-slate-500 hover:text-white text-sm underline text-center">Chọn lại đối thủ</button>
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl">
                                <button onClick={() => handleDecision('WHEEL')} className="group p-8 glass bg-slate-900/40 hover:bg-amber-600 border-amber-500/30 rounded-3xl transition-all text-center space-y-4"><Target className="mx-auto text-amber-500" size={48} /><h3 className="font-bold text-xl">QUAY HÌNH PHẠT</h3></button>
                                <button onClick={() => handleDecision('DUEL')} className="group p-8 glass bg-slate-900/40 hover:bg-indigo-600 border-indigo-500/30 rounded-3xl transition-all text-center space-y-4"><Swords className="mx-auto text-indigo-500" size={48} /><h3 className="font-bold text-xl">TỬ CHIẾN (SOLO)</h3></button>
                            </div>
                        )
                    ) : <div className="p-8 bg-slate-900/50 rounded-3xl border border-white/5 text-center"><p className="text-slate-400 italic">Đang chờ <span className="text-white font-bold">{loser.name}</span> đưa ra quyết định...</p></div>}
                </div>
            );

        case GameState.SPINNING_PENALTY:
            const penaltySpinData = roomData.spinData || { isSpinning: false, winnerIndex: null };
            const canSpinPenalty = isHost || isLoser || isController; 
            return (
                <div className="flex flex-col items-center gap-8 animate-in fade-in">
                    <h2 className="text-3xl font-bungee text-amber-500">Vòng quay hình phạt</h2>
                    {!penaltySpinData.isSpinning && <p className="text-slate-400 animate-pulse">⏳ Đang chờ <span className="text-white font-bold">{roomData.players[roomData.currentLoserId!]?.name}</span> hoặc Chủ phòng bấm quay...</p>}
                    <div className="relative">
                        <Wheel items={roomData.penalties.map((p, i) => ({ label: `${p.text} (${p.amount} ly)`, value: i.toString() }))} isSpinning={penaltySpinData.isSpinning} winnerIndex={penaltySpinData.winnerIndex} onFinished={handleSpinFinished} />
                        {canSpinPenalty && !penaltySpinData.isSpinning && <button onClick={() => startSynchronizedSpin('PENALTY')} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-rose-500 border-4 border-white shadow-xl text-white font-bold text-xl hover:bg-rose-600 hover:scale-110 transition-all z-20">QUAY</button>}
                    </div>
                </div>
            );

        case GameState.MINIGAME_DUEL: return <Minigames roomData={roomData} userId={userId} />;
        case GameState.RESULT:
            const resultPlayer = roomData.players[roomData.winnerId!];
            const isMe = roomData.winnerId === userId;
            return (
                <div className="flex flex-col items-center gap-10 animate-in zoom-in">
                    <div className="text-center space-y-4">
                        <div className={`p-6 rounded-full inline-block shadow-2xl ${isMe ? 'bg-amber-600' : 'bg-indigo-600'}`}><Beer size={80} className="text-white" /></div>
                        <h2 className="text-5xl font-bungee text-white">DZÔÔÔ!</h2>
                        <div className="space-y-2"><p className="text-2xl font-bold">{isMe ? 'BẠN PHẢI UỐNG' : `${resultPlayer.name} PHẢI UỐNG`}</p><p className="text-7xl font-bungee text-amber-500">{roomData.winnerBeerAmount} LY</p></div>
                    </div>
                    {isHost && <button onClick={backToLobby} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all shadow-lg hover:scale-105">TIẾP TỤC CUỘC VUI</button>}
                </div>
            );
        default: return null;
    }
  };

  return <div className="w-full relative">{renderPhase()}<button onClick={() => { console.log("ZÔOOOOOOO!"); }} className="fixed bottom-6 right-6 w-16 h-16 bg-yellow-500 hover:bg-yellow-400 rounded-full shadow-lg shadow-yellow-500/50 flex items-center justify-center border-4 border-yellow-200 active:scale-90 transition-all z-50 animate-bounce" title="Cụng ly!"><Beer size={32} className="text-red-900" /></button></div>;
};

export default GameBoard;
