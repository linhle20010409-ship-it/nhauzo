import React, { useRef, useEffect, useState } from 'react';

interface WheelProps {
  items: { label: string; value: string }[];
  winnerIndex: number | null; // Index của người sẽ thắng (được định đoạt trước)
  isSpinning: boolean;        // Trạng thái đang quay hay không
  onFinished: () => void;     // Hàm gọi khi quay xong
}

const Wheel: React.FC<WheelProps> = ({ items, winnerIndex, isSpinning, onFinished }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Góc quay hiện tại
  const [rotation, setRotation] = useState(0);

  // Cấu hình màu sắc
  const colors = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    drawWheel(rotation);
  }, [rotation, items]);

  // Xử lý logic quay hoạt hình (Animation)
  useEffect(() => {
    if (isSpinning && winnerIndex !== null) {
      let animationFrameId: number;
      const startTime = Date.now();
      const duration = 6000; // Tổng thời gian quay: 6 giây (tăng lên để kịch tính)
      
      // Tính toán góc quay đích:
      // 1. Quay ít nhất 5 vòng (5 * 360) cho chóng mặt
      // 2. Cộng thêm góc để kim chỉ đúng vào winnerIndex
      const segmentAngle = 360 / items.length;
      // Lưu ý: Canvas quay theo chiều kim đồng hồ, kim ở góc 270 độ (hoặc 0 tùy cách vẽ). 
      // Công thức này đảm bảo kim (thường ở trên cùng) chỉ đúng ô.
      // Offset -90 độ để kim ở vị trí 12h.
      const targetAngle = 360 * 10 + (360 - (winnerIndex * segmentAngle)) - (segmentAngle / 2); 

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Hàm Easing (Cubic Out): Quay nhanh lúc đầu, chậm dần đều về cuối
        // Công thức: 1 - pow(1 - x, 3)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Tính góc hiện tại
        const currentRotation = targetAngle * easeOut;
        setRotation(currentRotation);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          onFinished(); // Báo cáo đã quay xong
        }
      };

      animationFrameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [isSpinning, winnerIndex]); // Chạy lại khi trạng thái quay thay đổi

  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 10;
    const segmentAngle = (2 * Math.PI) / items.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Lưu trạng thái trước khi xoay
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((angle * Math.PI) / 180); // Xoay canvas theo góc animation
    ctx.translate(-centerX, -centerY);

    items.forEach((item, i) => {
      const startAngle = i * segmentAngle;
      const endAngle = (i + 1) * segmentAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.stroke();

      // Vẽ tên
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(item.label, radius - 20, 5);
      ctx.restore();
    });

    // Restore lại để vẽ cái kim không bị xoay theo vòng tròn
    ctx.restore();

    // Vẽ kim chỉ định (Mũi tên ở vị trí 3 giờ - 0 độ trong Canvas arc)
    // Để kim ở 12h thì logic vẽ wheel phải lệch 90 độ, ở đây ta vẽ kim bên phải (0 rad)
    // Để đơn giản, ta vẽ kim cố định ở bên phải (0 độ) -> Phần logic tính toán góc đích ở trên đã khớp.
    
    // Vẽ kim tam giác ở bên phải (chỉ vào tâm)
    ctx.beginPath();
    ctx.moveTo(canvas.width - 5, centerY);
    ctx.lineTo(canvas.width + 15, centerY - 10);
    ctx.lineTo(canvas.width + 15, centerY + 10);
    ctx.fillStyle = '#FF0000'; // Kim màu đỏ
    ctx.fill();
    
    // Vòng tròn tâm
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.stroke();
  };

  return (
    <div className="relative">
       <canvas 
        ref={canvasRef} 
        width={320} 
        height={320} 
        className="rounded-full shadow-2xl border-4 border-white"
      />
      {/* Kim chỉ định (Overlay CSS nếu muốn đẹp hơn) */}
      <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-0 h-0 
                      border-t-[15px] border-t-transparent
                      border-r-[25px] border-r-rose-600
                      border-b-[15px] border-b-transparent
                      filter drop-shadow-lg z-10" 
      />
    </div>
  );
};

export default Wheel;
