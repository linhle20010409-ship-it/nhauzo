import React, { useState, useEffect } from 'react';
import { db, createRoom, joinRoom } from './firebaseService';
import { ref, onValue, remove } from 'firebase/database';
import { GameState, GameData } from './types';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import { v4 as uuidv4 } from 'uuid';
import { Beer, Users, Play, LogOut, Settings, Hash } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState<GameData | null>(null);
  const [error, setError] = useState('');
  
  // Input states
  const [nameInput, setNameInput] = useState('');
  const [roomInput, setRoomInput] = useState('');

  // 1. Khôi phục user từ LocalStorage khi mới vào
  useEffect(() => {
    const savedUser = localStorage.getItem('drink_game_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setNameInput(parsedUser.name); // Điền sẵn tên cũ
    }
  }, []);

  // 2. Lắng nghe dữ liệu phòng khi có roomId
  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
      } else {
        // Phòng bị xóa hoặc không tồn tại
        setRoomData(null);
        setRoomId('');
        setError('Phòng không tồn tại hoặc đã bị giải tán.');
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  // 3. Xử lý tạo phòng
  const handleCreateRoom = async () => {
    if (!nameInput.trim()) return setError('Vui lòng nhập tên của bạn');
    
    // Nếu chưa có user thì tạo mới, nếu có rồi thì dùng lại ID cũ
    let currentUser = user;
    if (!currentUser) {
        const id = uuidv4();
        currentUser = { id, name: nameInput };
        setUser(currentUser);
        localStorage.setItem('drink_game_user', JSON.stringify(currentUser));
    } else if (currentUser.name !== nameInput) {
        // Cập nhật tên mới nếu người dùng đổi tên
        currentUser = { ...currentUser, name: nameInput };
        setUser(currentUser);
        localStorage.setItem('drink_game_user', JSON.stringify(currentUser));
    }

    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    try {
      await createRoom(currentUser.id, currentUser.name, newRoomId);
      setRoomId(newRoomId);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Không thể tạo phòng. Vui lòng thử lại.');
    }
  };

  // 4. Xử lý vào phòng
  const handleJoinRoom = async () => {
    if (!nameInput.trim()) return setError('Vui lòng nhập tên');
    if (!roomInput.trim()) return setError('Vui lòng nhập mã phòng');

    let currentUser = user;
    if (!currentUser) {
        const id = uuidv4();
        currentUser = { id, name: nameInput };
        setUser(currentUser);
        localStorage.setItem('drink_game_user', JSON.stringify(currentUser));
    } else if (currentUser.name !== nameInput) {
        currentUser = { ...currentUser, name: nameInput };
        setUser(currentUser);
        localStorage.setItem('drink_game_user', JSON.stringify(currentUser));
    }

    try {
      const targetRoomId = roomInput.toUpperCase();
      await joinRoom(targetRoomId, currentUser.id, currentUser.name);
      setRoomId(targetRoomId);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Lỗi khi vào phòng');
    }
  };

  // 5. Xử lý rời phòng
  const handleLeaveRoom = async () => {
    if (roomId && user) {
        // Nếu là Host thì xóa phòng, nếu là mem thì xóa tên khỏi list
        if (roomData?.hostId === user.id) {
             // Host rời -> Giải tán phòng (hoặc chuyển host, ở đây làm đơn giản là xóa)
             await remove(ref(db, `rooms/${roomId}`));
        } else {
             await remove(ref(db, `rooms/${roomId}/players/${user.id}`));
        }
    }
    setRoomId('');
    setRoomData(null);
    setRoomInput('');
  };

  // --- RENDER ---

  // MÀN HÌNH GAME (LOBBY HOẶC GAMEBOARD)
  // Điều kiện: Đã vào phòng (roomId) + Có dữ liệu phòng (roomData) + Đã có user
  if (roomId && roomData && user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden">
        
        {/* Nút thoát phòng */}
        <div className="absolute top-4 left-4 z-50">
           <button 
            onClick={handleLeaveRoom}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-red-900/80 border border-slate-600 hover:border-red-500 rounded-full transition-all text-sm font-bold backdrop-blur-md"
           >
             <LogOut size={16} />
             <span>THOÁT</span>
           </button>
        </div>

        {/* Nội dung chính */}
        <div className="w-full min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
          {roomData.state === GameState.LOBBY ? (
            <Lobby roomData={roomData} userId={user.id} />
          ) : (
            <GameBoard roomData={roomData} userId={user.id} />
          )}
        </div>
      </div>
    );
  }

  // MÀN HÌNH CHÀO (LOGIN / TẠO PHÒNG)
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl space-y-8 animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] animate-bounce">
              <Beer size={48} className="text-white drop-shadow-md" />
            </div>
          </div>
          <div>
              <h1 className="text-5xl font-bungee text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-600 drop-shadow-sm">
                NHẬU ZÔ!
              </h1>
              <p className="text-slate-400 font-medium text-sm mt-1">Sát phạt trên bàn nhậu online</p>
          </div>
        </div>

        {/* Form nhập liệu */}
        <div className="space-y-5">
          {/* Nhập tên */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Tên dân chơi</label>
            <div className="relative">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="w-full pl-4 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-white placeholder:text-slate-600 font-medium"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Nút Tạo Phòng */}
            <button
              onClick={handleCreateRoom}
              className="group flex flex-col items-center justify-center gap-2 p-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all transform hover:-translate-y-1 active:scale-95 shadow-lg shadow-indigo-900/50 border border-indigo-400/20"
            >
              <Settings className="text-indigo-200 group-hover:text-white transition-colors" size={24} />
              <span className="font-bold text-white">TẠO PHÒNG</span>
            </button>

            {/* Nút Vào Phòng */}
            <button
              onClick={handleJoinRoom}
              className="group flex flex-col items-center justify-center gap-2 p-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all transform hover:-translate-y-1 active:scale-95 shadow-lg shadow-emerald-900/50 border border-emerald-400/20"
            >
              <Users className="text-emerald-200 group-hover:text-white transition-colors" size={24} />
              <span className="font-bold text-white">VÀO NGAY</span>
            </button>
          </div>

          {/* Input Mã Phòng */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Hash size={18} className="text-slate-500 group-focus-within:text-amber-500 transition-colors" />
            </div>
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="NHẬP MÃ PHÒNG (NẾU CÓ)"
              className="w-full pl-10 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-center font-bold tracking-[0.2em] text-lg text-white placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
            />
          </div>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            <span className="text-rose-400 text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest">
            Uống có trách nhiệm • Đã uống không lái xe
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
