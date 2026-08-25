import React, { useEffect, useState, useRef } from 'react';

interface Props {
  dice1: number;
  dice2: number;
  onAnimationEnd: () => void;
}

export function Dice3D({ dice1, dice2, onAnimationEnd }: Props) {
  const [isRolling, setIsRolling] = useState(true);

  const onAnimationEndRef = useRef(onAnimationEnd);
  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRolling(false);
      setTimeout(() => onAnimationEndRef.current(), 1500); // Allow time to see the result before dismissing
    }, 1500); // 1.5 seconds rolling
    return () => clearTimeout(timer);
  }, []);

  const getRotation = (value: number) => {
    switch (value) {
      case 1: return 'rotateX(0deg) rotateY(0deg)';
      case 2: return 'rotateX(-90deg) rotateY(0deg)';
      case 3: return 'rotateX(0deg) rotateY(-90deg)';
      case 4: return 'rotateX(0deg) rotateY(90deg)';
      case 5: return 'rotateX(90deg) rotateY(0deg)';
      case 6: return 'rotateX(180deg) rotateY(0deg)';
      default: return 'rotateX(0deg) rotateY(0deg)';
    }
  };

  const renderDots = (value: number) => {
    const dots = [];
    for (let i = 0; i < value; i++) {
      dots.push(<div key={i} className="w-3 h-3 bg-gray-900 rounded-full shadow-inner" />);
    }
    return dots;
  };

  const faceClasses = "absolute w-20 h-20 bg-white border-2 border-gray-300 rounded-xl shadow-lg flex items-center justify-center p-3 box-border";
  const getFaceStyle = (value: number) => {
    // Determine dot layout
    let layoutClass = "";
    if (value === 1) layoutClass = "flex items-center justify-center";
    else if (value === 2) layoutClass = "flex justify-between flex-col items-center [&>div:first-child]:self-start [&>div:last-child]:self-end h-full w-full py-1";
    else if (value === 3) layoutClass = "flex justify-between flex-col items-center [&>div:first-child]:self-start [&>div:nth-child(2)]:self-center [&>div:last-child]:self-end h-full w-full py-1";
    else if (value === 4) layoutClass = "grid grid-cols-2 grid-rows-2 gap-4 place-items-center h-full w-full";
    else if (value === 5) layoutClass = "grid grid-cols-3 grid-rows-3 gap-1 place-items-center h-full w-full [&>div:nth-child(1)]:col-start-1 [&>div:nth-child(1)]:row-start-1 [&>div:nth-child(2)]:col-start-3 [&>div:nth-child(2)]:row-start-1 [&>div:nth-child(3)]:col-start-2 [&>div:nth-child(3)]:row-start-2 [&>div:nth-child(4)]:col-start-1 [&>div:nth-child(4)]:row-start-3 [&>div:nth-child(5)]:col-start-3 [&>div:nth-child(5)]:row-start-3";
    else if (value === 6) layoutClass = "grid grid-cols-2 grid-rows-3 gap-2 place-items-center h-full w-full";
    
    return layoutClass;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
      <style>{`
        .dice-container {
          perspective: 1000px;
        }
        .dice {
          width: 80px;
          height: 80px;
          transform-style: preserve-3d;
          transition: transform 1s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .dice-rolling {
          animation: rolling 1.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }
        @keyframes rolling {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          50% { transform: rotateX(720deg) rotateY(360deg) rotateZ(180deg); }
          100% { transform: var(--final-transform); }
        }
        .face-1 { transform: translateZ(40px); }
        .face-2 { transform: rotateX(90deg) translateZ(40px); }
        .face-3 { transform: rotateY(90deg) translateZ(40px); }
        .face-4 { transform: rotateY(-90deg) translateZ(40px); }
        .face-5 { transform: rotateX(-90deg) translateZ(40px); }
        .face-6 { transform: rotateX(180deg) translateZ(40px); }
      `}</style>
      
      <div className="flex gap-8 dice-container">
        {[dice1, dice2].map((diceValue, idx) => (
          <div 
            key={idx}
            className={`dice ${isRolling ? 'dice-rolling' : ''}`}
            style={{ 
              transform: isRolling ? undefined : getRotation(diceValue),
              '--final-transform': getRotation(diceValue)
            } as React.CSSProperties}
          >
            <div className={`${faceClasses} face-1`}>
              <div className={getFaceStyle(1)}>{renderDots(1)}</div>
            </div>
            <div className={`${faceClasses} face-2`}>
              <div className={getFaceStyle(2)}>{renderDots(2)}</div>
            </div>
            <div className={`${faceClasses} face-3`}>
              <div className={getFaceStyle(3)}>{renderDots(3)}</div>
            </div>
            <div className={`${faceClasses} face-4`}>
              <div className={getFaceStyle(4)}>{renderDots(4)}</div>
            </div>
            <div className={`${faceClasses} face-5`}>
              <div className={getFaceStyle(5)}>{renderDots(5)}</div>
            </div>
            <div className={`${faceClasses} face-6`}>
              <div className={getFaceStyle(6)}>{renderDots(6)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
