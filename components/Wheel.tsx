
import React, { useState, useEffect, useRef } from 'react';

interface WheelProps {
  items: { label: string; value: string }[];
  onFinished: (winnerValue: string) => void;
  canSpin: boolean;
}

const Wheel: React.FC<WheelProps> = ({ items, onFinished, canSpin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    drawWheel();
  }, [items, rotation]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    const arcSize = (2 * Math.PI) / items.length;

    ctx.clearRect(0, 0, size, size);

    items.forEach((item, i) => {
      const angle = i * arcSize + rotation;
      ctx.beginPath();
      ctx.fillStyle = i % 2 === 0 ? '#4f46e5' : '#6366f1';
      if (items.length % 2 !== 0 && i === items.length - 1) ctx.fillStyle = '#4338ca';
      
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Inter';
      ctx.fillText(item.label.substring(0, 15), radius - 20, 5);
      ctx.restore();
    });

    // Pointer
    ctx.beginPath();
    ctx.fillStyle = '#f59e0b';
    ctx.moveTo(size - 20, centerY);
    ctx.lineTo(size, centerY - 15);
    ctx.lineTo(size, centerY + 15);
    ctx.fill();
  };

  const spin = () => {
    if (isSpinning || !canSpin) return;
    setIsSpinning(true);
    
    const spinRotation = Math.PI * 10 + Math.random() * Math.PI * 5;
    const startTime = performance.now();
    const duration = 4000;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentRot = rotation + spinRotation * easeOut;
      setRotation(currentRot);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        const finalAngle = currentRot % (2 * Math.PI);
        const arcSize = (2 * Math.PI) / items.length;
        // The pointer is at 0 degrees (pointing left on canvas usually, but we draw it right)
        // Adjust for our pointer being on the right (0 rad)
        let winningIdx = items.length - 1 - Math.floor((finalAngle % (2 * Math.PI)) / arcSize);
        // Correcting the pointer index calculation
        winningIdx = (items.length - Math.floor((finalAngle % (2 * Math.PI)) / arcSize)) % items.length;
        
        onFinished(items[winningIdx].value);
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div className="relative group cursor-pointer" onClick={spin}>
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={400} 
        className={`rounded-full border-4 border-slate-700 shadow-2xl bg-slate-800 transition-transform ${isSpinning ? '' : 'hover:scale-105'}`}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-950 rounded-full border-4 border-amber-500 flex items-center justify-center font-bungee text-amber-500 shadow-inner">
        GO!
      </div>
    </div>
  );
};

export default Wheel;
