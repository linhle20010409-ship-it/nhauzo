
import React, { useState } from 'react';
import { GameData, GameMode, Player, Penalty } from '../types';
import { updateRoom } from '../firebaseService';
import { Users, Crown, Settings, Play, Plus, Trash2, Edit2, Info } from 'lucide-react';

interface LobbyProps {
  roomData: GameData;
  userId: string;
}

const Lobby: React.FC<LobbyProps> = ({ roomData, userId }) => {
  const isHost = roomData.hostId === userId;
  // Fix: Explicitly cast to Player[] to avoid unknown type errors in strict mode
  const players = Object.values(roomData.players || {}) as Player[];
  const [showSettings, setShowSettings] = useState(false);
  const [newPenaltyText, setNewPenaltyText] = useState('');
  const [newPenaltyAmount, setNewPenaltyAmount] = useState(1);

  const startGame = async (mode: GameMode) => {
    if (!isHost) return;
    const updates: any = { 
        state: 'PICKING_LOSER', 
        mode,
        deathNumber: mode === GameMode.DEATH_NUMBER ? Math.floor(Math.random() * 20) + 1 : null
    };
    await updateRoom(roomData.id, updates);
  };

  const addPenalty = async () => {
    if (!newPenaltyText.trim()) return;
    const newPenalty: Penalty = { text: newPenaltyText, amount: newPenaltyAmount };
    await updateRoom(roomData.id, {
        penalties: [...(roomData.penalties || []), newPenalty]
    });
    setNewPenaltyText('');
    setNewPenaltyAmount(1);
  };

  const removePenalty = async (index: number) => {
    const updated = roomData.penalties.filter((_, i) => i !== index);
    await updateRoom(roomData.id, { penalties: updated });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Players List */}
      <div className="lg:col-span-1 glass p-6 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <Users className="text-amber-500" />
            <h2 className="text-xl font-bold">Người chơi ({players.length})</h2>
          </div>
          <div className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-amber-500 tracking-wider">
            MÃ: {roomData.id}
          </div>
        </div>
        
        <div className="space-y-3">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold">
                  {p.name[0].toUpperCase()}
                </div>
                <span className={`font-semibold ${p.id === userId ? 'text-amber-400' : ''}`}>{p.name}</span>
              </div>
              {p.isHost && <Crown size={18} className="text-amber-500 fill-amber-500" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-2 space-y-8">
        <div className="glass p-10 rounded-3xl text-center space-y-6 bg-gradient-to-br from-indigo-900/40 to-transparent">
          <h1 className="text-5xl font-bungee text-white">SẴN SÀNG CHƯA?</h1>
          <p className="text-slate-400">Chủ phòng chọn chế độ để bắt đầu cuộc vui!</p>
          
          {isHost ? (
            <div className="grid sm:grid-cols-3 gap-4 pt-6">
              <button 
                onClick={() => startGame(GameMode.RANDOM)}
                className="group p-6 bg-slate-900 hover:bg-indigo-600 rounded-3xl border border-indigo-500/30 transition-all text-center space-y-3"
              >
                <div className="mx-auto w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                  <Play size={24} />
                </div>
                <h3 className="font-bold text-lg">Ngẫu nhiên</h3>
                <p className="text-xs text-slate-500 group-hover:text-indigo-100">Xoay vòng quay chọn người đen nhất.</p>
              </button>

              <button 
                onClick={() => startGame(GameMode.DEATH_NUMBER)}
                className="group p-6 bg-slate-900 hover:bg-rose-600 rounded-3xl border border-rose-500/30 transition-all text-center space-y-3"
              >
                <div className="mx-auto w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:text-rose-600 transition-colors">
                  <Info size={24} />
                </div>
                <h3 className="font-bold text-lg">Số tử thần</h3>
                <p className="text-xs text-slate-500 group-hover:text-rose-100">Chọn 1 số từ 1-20. Ai trúng số đen phải uống.</p>
              </button>

              <button 
                onClick={() => startGame(GameMode.VOTING)}
                className="group p-6 bg-slate-900 hover:bg-emerald-600 rounded-3xl border border-emerald-500/30 transition-all text-center space-y-3"
              >
                <div className="mx-auto w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                  <Users size={24} />
                </div>
                <h3 className="font-bold text-lg">Bỏ phiếu</h3>
                <p className="text-xs text-slate-500 group-hover:text-emerald-100">Cùng nhau vote xem ai là người phải uống.</p>
              </button>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center space-y-4">
                <div className="animate-spin-slow p-4 bg-slate-800 rounded-full">
                    <Settings className="text-slate-400" size={32} />
                </div>
                <p className="text-slate-400 animate-pulse italic">Đang chờ chủ phòng bắt đầu...</p>
            </div>
          )}
        </div>

        {/* Penalty Settings (Host only) */}
        {isHost && (
          <div className="glass p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Edit2 size={20} className="text-amber-500" />
                    Chỉnh sửa hình phạt
                </h2>
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-xs font-bold text-indigo-400 uppercase hover:text-white"
                >
                    {showSettings ? 'Thu gọn' : 'Mở rộng'}
                </button>
            </div>
            
            {showSettings && (
                <div className="space-y-4 animate-in slide-in-from-top duration-300">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Tên hình phạt..." 
                            value={newPenaltyText}
                            onChange={(e) => setNewPenaltyText(e.target.value)}
                            className="flex-1 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700 outline-none focus:border-indigo-500"
                        />
                        <input 
                            type="number" 
                            min="0"
                            max="5"
                            value={newPenaltyAmount}
                            onChange={(e) => setNewPenaltyAmount(parseInt(e.target.value))}
                            className="w-16 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700 outline-none"
                        />
                        <button 
                            onClick={addPenalty}
                            className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {roomData.penalties.map((penalty, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-white/5">
                                <span className="text-sm truncate">{penalty.text} ({penalty.amount} ly)</span>
                                <button onClick={() => removePenalty(idx)} className="text-rose-500 hover:text-rose-400">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
