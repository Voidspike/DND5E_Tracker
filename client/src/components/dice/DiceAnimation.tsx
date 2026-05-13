import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';

interface RollingDice {
  id: number;
  sides: number;
  result: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
}

// Unicode dice faces for d4, d6, d8, d10, d12, d20
const DICE_GLYPHS: Record<number, string> = {
  4: '◆', 6: '⬡', 8: '⬢', 10: '◆', 12: '⬟', 20: '⬠',
};

export default function DiceAnimation() {
  const { diceHistory } = useGameStore();
  const [rolling, setRolling] = useState<RollingDice[]>([]);
  const prevLengthRef = useRef(0);
  const idCounterRef = useRef(0);

  useEffect(() => {
    if (diceHistory.length === 0) return;
    if (diceHistory.length === prevLengthRef.current) return;
    prevLengthRef.current = diceHistory.length;

    const latest = diceHistory[0];
    const sides = parseInt(latest.diceType.replace('d', ''), 10) || 20;

    // Create 3-5 rolling dice
    const count = Math.min(3 + Math.floor(Math.random() * 3), 5);
    const newDice: RollingDice[] = [];

    for (let i = 0; i < count; i++) {
      newDice.push({
        id: idCounterRef.current++,
        sides,
        result: i === count - 1 ? latest.result - (latest.modifier || 0) : Math.floor(Math.random() * sides) + 1,
        x: 40 + Math.random() * 20,
        y: 30 + Math.random() * 20,
        rotation: Math.random() * 720 - 360,
        scale: 1,
        opacity: 0.9,
      });
    }
    setRolling(newDice);

    // Clean up after animation
    setTimeout(() => setRolling([]), 2500);
  }, [diceHistory.length]);

  if (rolling.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center">
      <div className="relative w-72 h-48">
        {rolling.map((d, i) => (
          <div
            key={d.id}
            className="absolute flex flex-col items-center justify-center transition-all duration-[2000ms] ease-out"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: `translate(-50%, -50%) rotate(${d.rotation}deg) scale(${d.scale})`,
              opacity: d.opacity,
              transitionDelay: `${i * 200}ms`,
            }}
          >
            <span className="text-5xl drop-shadow-lg">
              {DICE_GLYPHS[d.sides] || '🎲'}
            </span>
            <span className="text-2xl font-bold text-white drop-shadow-lg mt-1">
              {d.result}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
