
import React, { useState, useEffect, useCallback } from 'react';
import { db, createRoom, joinRoom, updateRoom } from './firebaseService';
import { ref, onValue, remove } from 'firebase/database';
import { GameMode, GameState, Player, GameData, MinigameType } from './types';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import { v4 as uuidv4 } from 'uuid';
import { Beer, Users, Play, LogOut, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState<GameData | null>(null);
  const [error, setError] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [roomInput, setRoomInput] = useState('');

  // Auto-login or session recovery
  useEffect(() => {
    const savedUser = localStorage.getItem('drink_game_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (roomId) {
      const roomRef = ref(db, `rooms/${roomId}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setRoomData(data);
        } else {
          setRoomData(null);
          setRoomId('');
          setError('Phòng đã bị đóng bởi chủ phòng.');
        }
      });
      return () => unsubscribe();
    }
  }, [roomId]);

  const handleCreateRoom = async () => {
    if (!nameInput.trim()) return setError('Vui lòng nhập tên');
    const id = uuidv4();
    const newUser = { id, name: nameInput };
    setUser(newUser);
    localStorage.setItem('drink_game_user', JSON.stringify(newUser));
    
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
      await createRoom(id, nameInput, newRoomId);
      setRoomId(newRoomId);
      setError('');
    } catch (err) {
      setError('Lỗi tạo phòng');
    }
  };

  const handleJoinRoom = async () => {
    if (!nameInput.trim() || !roomInput.trim()) return setError('Vui lòng nhập tên và mã phòng');
    const id = uuidv4();
    const newUser = { id, name: nameInput };
    setUser(newUser);
    localStorage.setItem('drink_game_user', JSON.stringify(newUser));

    try {
      await joinRoom(roomInput.toUpperCase(), id, nameInput);
      setRoomId(roomInput.toUpperCase());
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveRoom = async () => {
    if (roomData && user) {
      if (roomData.hostId === user.id) {
        await remove(ref(db, `rooms/${roomId}`));
      } else {
        await remove(ref(db, `rooms/${roomId}/players/${user.id}`));
      }
    }
    setRoomId('');
    setRoomData(null);
  };

  if (roomId && roomData && user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white relative">
        <div className="absolute top-4 left-4 z-50">
           <button 
            onClick={handleLeaveRoom}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600 border border-red-500 rounded-full transition-all"
           >
             <LogOut size={18} />
             <span>Rời phòng</span>
           </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-16">
          {roomData.state === GameState.LOBBY ? (
            <Lobby roomData={roomData} userId={user.id} />
          ) : (
            <GameBoard roomData={roomData} userId={user.id} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950">
      <div className="w-full max-w-md glass p-8 rounded-3xl shadow-2xl space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-amber-500 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-bounce">
              <Beer size={48} className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bungee text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600">
            NHẬU ZÔ!
          </h1>
          <p className="text-slate-400 font-medium">Bản lĩnh trên bàn nhậu</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Tên của bạn</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ví dụ: Anh Ba, Chú Bảy..."
              className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCreateRoom}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/30"
            >
              <Settings size={20} />
              Tạo phòng
            </button>
            <button
              onClick={handleJoinRoom}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/30"
            >
              <Users size={20} />
              Vào phòng
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center text-slate-500">
              <Play size={16} />
            </div>
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="MÃ PHÒNG (VD: ABCD)"
              className="w-full pl-10 pr-4 py-4 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600 text-center font-bold tracking-widest"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm text-center font-medium animate-pulse">
            {error}
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">Made with ❤️ for Vietnamese Drinkers</p>
        </div>
      </div>
    </div>
  );
};

export default App;
