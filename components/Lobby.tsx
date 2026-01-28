import React, { useState } from 'react';
import { GameData, GameState, GameMode, Penalty } from '../types';
import { updateRoom } from '../firebaseService';
import { Users, Crown, Dices, Skull, Vote, UserCheck, Settings, Plus, Trash2, RotateCcw, ChevronLeft } from 'lucide-react';

interface LobbyProps {
  roomData: GameData;
  userId: string;
}

const Lobby: React.FC<LobbyProps> = ({ roomData, userId }) => {
  const players = Object.values(roomData.players);
  const isHost = roomData.hostId === userId;
  const controllerId = roomData.nextControllerId || roomData.hostId;
  const isController = userId === controllerId;
  const controllerName = roomData.players[controllerId]?.name || "Chủ phòng";

  // State cho phần chỉnh sửa hình phạt
  const [isEditingPenalties, setIsEditingPenalties] = useState(false);
  const [newPenaltyText, setNewPenaltyText] = useState('');
  const [newPenaltyAmount, setNewPenaltyAmount] = useState(1);

  const startGame = async (mode: GameMode) => {
    if (!isController && !isHost) return;
    await updateRoom(roomData.id, {
      state: GameState.PICKING_LOSER,
      mode: mode,
      spinData: null
    });
  };

  // --- LOGIC QUẢN LÝ HÌNH PHẠT ---
  const handleAddPenalty = async () => {
      if (!newPenaltyText.trim()) return;
      const newPenalty: Penalty = { text: newPenaltyText, amount: newPenaltyAmount };
      const updatedPenalties = [...roomData.penalties, newPenalty];
      await updateRoom(roomData.id, { penalties: updatedPenalties });
      setNewPenaltyText('');
      setNewPenaltyAmount(1);
  };

  const handleRemovePenalty = async (index: number) => {
      const updatedPenalties = roomData.penalties.filter((_, i) => i !== index);
      await updateRoom(roomData.id, { penalties: updatedPenalties });
  };

  const handleResetPenalties = async () => {
      const defaultPenalties: Penalty[] = [
          { text: "Uống", amount: 1 },
          { text: "Uống", amount: 2 },
          { text: "Uống nửa ly", amount: 0.5 },
          { text: "Mời người bên trái", amount: 1 },
          { text: "Mời người bên phải", amount: 1 },
          { text: "Qua tua", amount: 0 },
      ];
      await updateRoom(roomData.id, { penalties: defaultPenalties });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl animate-in fade-in">
      {/* CỘT TRÁI: DANH SÁCH NGƯỜI CHƠI */}
      <div className="w-full md:w-1/3 bg-slate-900/80 p-6 rounded-3xl border border-white/10 shadow-xl backdrop-blur-md h-fit">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-indigo-400">
            <Users size={24} />
            <h2 className="font-bold text-lg">Người chơi ({players.length})</h2>
          </div>
          <div className="bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-mono border border-indigo-500/30">
            MÃ: {roomData.id}
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-white/5 group hover:border-indigo-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${p.id === roomData.hostId ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                   <span className="font-medium text-slate-200">{p.name}</span>
                   {p.id === controllerId && <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1"><Crown size={10} /> Đang cầm cái</span>}
                </div>
              </div>
              {p.id === roomData.hostId && <Crown size={18} className="text-amber-500" />}
            </div>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: CHỌN CHẾ ĐỘ HOẶC CÀI ĐẶT */}
      <div className="w-full md:w-2/3 bg-indigo-900/20 p-8 rounded-3xl border border-indigo-500/20 shadow-2xl backdrop-blur-sm flex flex-col items-center justify-center min-h-[400px] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
        
        {/* NÚT CHUYỂN ĐỔI GIAO DIỆN (CHỈ HOST THẤY) */}
        {isHost && (
            <button 
                onClick={() => setIsEditingPenalties(!isEditingPenalties)}
                className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-600 transition-all z-10"
                title="Cài đặt hình phạt"
            >
                {isEditingPenalties ? <ChevronLeft size={20} /> : <Settings size={20} />}
            </button>
        )}

        {isEditingPenalties ? (
            // --- GIAO DIỆN CHỈNH SỬA HÌNH PHẠT ---
            <div className="w-full h-full flex flex-col animate-in slide-in-from-right">
                <h2 className="text-2xl font-bungee text-amber-500 mb-6">CÀI ĐẶT HÌNH PHẠT</h2>
                
                <div className="flex gap-2 mb-4">
                    <input type="text" value={newPenaltyText} onChange={(e) => setNewPenaltyText(e.target.value)} placeholder="Tên hình phạt..." className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 outline-none focus:border-amber-500" />
                    <input type="number" value={newPenaltyAmount} onChange={(e) => setNewPenaltyAmount(Number(e.target.value))} min={0} max={10} step={0.5} className="w-20 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-center outline-none focus:border-amber-500" />
                    <button onClick={handleAddPenalty} className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl"><Plus size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[300px] pr-2">
                    {roomData.penalties.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5">
                            <span className="text-left font-medium">{p.text} <span className="text-amber-400">({p.amount} ly)</span></span>
                            <button onClick={() => handleRemovePenalty(idx)} className="text-slate-500 hover:text-rose-500"><Trash2 size={18}/></button>
                        </div>
                    ))}
                </div>

                <button onClick={handleResetPenalties} className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white py-2">
                    <RotateCcw size={14}/> Khôi phục mặc định
                </button>
            </div>
        ) : (
            // --- GIAO DIỆN CHỌN GAME ---
            <div className="w-full flex flex-col items-center animate-in slide-in-from-left">
                <h1 className="text-5xl font-bungee text-white mb-2 drop-shadow-lg">SẴN SÀNG CHƯA?</h1>
                <div className="mb-8 flex flex-col items-center gap-2">
                    <p className="text-slate-400">Người có quyền chọn chế độ:</p>
                    <div className="flex items-center gap-2 bg-slate-800/80 px-5 py-2 rounded-full border border-amber-500/50 shadow-lg">
                        <UserCheck className="text-amber-400" size={20} />
                        <span className="text-xl font-bold text-amber-400">{controllerName}</span>
                    </div>
                </div>

                {isController ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    <button onClick={() => startGame(GameMode.RANDOM)} className="group p-6 bg-slate-800 hover:bg-amber-600 border border-slate-700 hover:border-amber-400 rounded-2xl transition-all flex flex-col items-center gap-3">
                        <Dices size={32} className="text-amber-500 group-hover:text-white" />
                        <div><h3 className="font-bold text-white text-lg">VÒNG QUAY</h3><p className="text-xs text-slate-400 group-hover:text-amber-100 mt-1">Random người uống</p></div>
                    </button>
                    <button onClick={() => startGame(GameMode.DEATH_NUMBER)} className="group p-6 bg-slate-800 hover:bg-rose-600 border border-slate-700 hover:border-rose-400 rounded-2xl transition-all flex flex-col items-center gap-3">
                        <Skull size={32} className="text-rose-500 group-hover:text-white" />
                        <div><h3 className="font-bold text-white text-lg">SỐ TỬ THẦN</h3><p className="text-xs text-slate-400 group-hover:text-rose-100 mt-1">Đừng chọn sai số!</p></div>
                    </button>
                    <button onClick={() => startGame(GameMode.VOTING)} className="group p-6 bg-slate-800 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-400 rounded-2xl transition-all flex flex-col items-center gap-3">
                        <Vote size={32} className="text-emerald-500 group-hover:text-white" />
                        <div><h3 className="font-bold text-white text-lg">BỎ PHIẾU</h3><p className="text-xs text-slate-400 group-hover:text-emerald-100 mt-1">Vote ai đen nhất</p></div>
                    </button>
                </div>
                ) : (
                <div className="p-8 border border-dashed border-slate-600 rounded-2xl bg-slate-900/30">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-400 italic">Đang chờ <span className="font-bold text-white">{controllerName}</span> chọn trò chơi...</p>
                </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
