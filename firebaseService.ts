
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, onDisconnect, get } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://random-drink-game-by-linhle-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const createRoom = async (hostId: string, hostName: string, roomId: string) => {
  const roomRef = ref(db, `rooms/${roomId}`);
  const initialPenalties = [
    { text: "Uống 1 ly", amount: 1 },
    { text: "Uống 2 ly", amount: 2 },
    { text: "Hôn người bên cạnh", amount: 1 },
    { text: "Thoát nạn", amount: 0 },
    { text: "Chỉ định 1 người uống", amount: 1 },
    { text: "Uống cạn ly", amount: 3 }
  ];

  const data = {
    id: roomId,
    hostId,
    mode: 'RANDOM',
    state: 'LOBBY',
    players: {
      [hostId]: { id: hostId, name: hostName, isHost: true }
    },
    penalties: initialPenalties,
    lastUpdate: Date.now()
  };

  await set(roomRef, data);
  // Auto close room if host leaves
  onDisconnect(roomRef).remove();
  return data;
};

export const joinRoom = async (roomId: string, playerId: string, playerName: string) => {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) throw new Error("Phòng không tồn tại");
  
  await update(ref(db, `rooms/${roomId}/players/${playerId}`), {
    id: playerId,
    name: playerName,
    isHost: false
  });
};

export const updateRoom = async (roomId: string, updates: any) => {
  await update(ref(db, `rooms/${roomId}`), {
    ...updates,
    lastUpdate: Date.now()
  });
};
