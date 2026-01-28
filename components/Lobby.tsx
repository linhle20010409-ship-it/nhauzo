import React from 'react';
import { GameData, GameState, GameMode } from '../types';
import { updateRoom } from '../firebaseService';
import { Users, Crown, Dices, Skull, Vote, UserCheck } from 'lucide-react';

interface LobbyProps {
  roomData: GameData;
  userId: string;
}

const Lobby: React.FC<LobbyProps> = ({ roomData, userId }) => {
  const players = Object.values(roomData.players);
  const isHost = roomData.hostId === userId;

  // --- XÁC ĐỊNH NGƯỜI CẦM CÁI (CONTROLLER) ---
  // Người thua ván trước sẽ có quyền chọn. Nếu chưa có (ván đầu) thì là Host.
  const controllerId = roomData.nextControllerId || roomData.hostId;
  const isController = userId === controllerId;
  const controllerName = roomData.players[controllerId]?.name || "Chủ phòng";

  // Hàm chọn chế độ chơi
  const startGame = async (mode: GameMode) => {
    // Chỉ Controller hoặc Host mới được bấm
    if (!isController && !isHost) return;

    await updateRoom(roomData.id, {
      state: GameState.PICKING_LOSER, // Chuyển sang màn hình game
      mode: mode,
      spinData: null // Reset dữ liệu quay nếu có
    });
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg
                  ${p.id === roomData.hostId ? 'bg-amber-500' : 'bg-indigo-600'}
                `}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                   <span className="font-medium text-slate-200">{p.name}</span>
                   {p.id === controllerId && (
                       <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Crown size={10} /> Đang cầm cái
                       </span>
                   )}
                </div>
              </div>
              {p.id === roomData.hostId && <Crown size={18} className="text-amber-500" />}
            </div>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: CHỌN CHẾ ĐỘ CHƠI */}
      <div className="w-full md:w-2/3 bg-indigo-900/20 p-8 rounded-3xl border border-indigo-500/20 shadow-2xl backdrop-blur-sm flex flex-col items-center justify-center min-h-[400px] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
        
        <h1 className="text-5xl font-bungee text-white mb-2 drop-shadow-lg">SẴN SÀNG CHƯA?</h1>
        
        {/* Hiển thị ai đang chọn */}
        <div className="mb-8 flex flex-col items-center gap-2">
            <p className="text-slate-400">Người có quyền chọn chế độ:</p>
            <div className="flex items-center gap-2 bg-slate-800/80 px-5 py-2 rounded-full border border-amber-500/50 shadow-lg">
                <UserCheck className="text-amber-400" size={20} />
                <span className="text-xl font-bold text-amber-400">{controllerName}</span>
            </div>
        </div>

        {isController ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <button 
              onClick={() => startGame(GameMode.RANDOM)}
              className="group relative p-6 bg-slate-800 hover:bg-amber-600 border border-slate-700 hover:border-amber-400 rounded-2xl transition-all duration-300 flex flex-col items-center gap-3 shadow-lg hover:shadow-amber-600/20 hover:-translate-y-1"
            >
              <div className="p-4 bg-slate-900 group-hover:bg-white/20 rounded-full transition-colors">
                <Dices size={32} className="text-amber-500 group-hover:text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">VÒNG QUAY</h3>
                <p className="text-xs text-slate-400 group-hover:text-amber-100 mt-1">Random người uống</p>
              </div>
            </button>

            <button 
              onClick={() => startGame(GameMode.DEATH_NUMBER)}
              className="group relative p-6 bg-slate-800 hover:bg-rose-600 border border-slate-700 hover:border-rose-400 rounded-2xl transition-all duration-300 flex flex-col items-center gap-3 shadow-lg hover:shadow-rose-600/20 hover:-translate-y-1"
            >
              <div className="p-4 bg-slate-900 group-hover:bg-white/20 rounded-full transition-colors">
                <Skull size={32} className="text-rose-500 group-hover:text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">SỐ TỬ THẦN</h3>
                <p className="text-xs text-slate-400 group-hover:text-rose-100 mt-1">Đừng chọn sai số!</p>
              </div>
            </button>

            <button 
              onClick={() => startGame(GameMode.VOTING)}
              className="group relative p-6 bg-slate-800 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-400 rounded-2xl transition-all duration-300 flex flex-col items-center gap-3 shadow-lg hover:shadow-emerald-600/20 hover:-translate-y-1"
            >
              <div className="p-4 bg-slate-900 group-hover:bg-white/20 rounded-full transition-colors">
                <Vote size={32} className="text-emerald-500 group-hover:text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">BỎ PHIẾU</h3>
                <p className="text-xs text-slate-400 group-hover:text-emerald-100 mt-1">Vote ai đen nhất</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-600 rounded-2xl bg-slate-900/30">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400 italic">Đang chờ <span className="font-bold text-white">{controllerName}</span> chọn trò chơi...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
