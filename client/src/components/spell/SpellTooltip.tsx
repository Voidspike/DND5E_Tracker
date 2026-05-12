import { useState, useRef, useCallback, useEffect } from 'react';

interface SpellData {
  en: string;
  cn: string;
  level: number;
  school: string;
  castTime: string;
  range: string;
  components: string;
  duration: string;
  desc: string;
  classes?: string;
}

interface SpellTooltipProps {
  spell: SpellData;
  children: React.ReactNode;
}

const LEVEL_LABELS: Record<number, string> = {
  0: '戏法', 1: '1环', 2: '2环', 3: '3环', 4: '4环',
  5: '5环', 6: '6环', 7: '7环', 8: '8环', 9: '9环',
};

export default function SpellTooltip({ spell, children }: SpellTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = useCallback((e: React.MouseEvent) => {
    timerRef.current = setTimeout(() => {
      setPos({ x: e.clientX, y: e.clientY });
      setVisible(true);
    }, 600);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const move = useCallback((e: React.MouseEvent) => {
    if (visible) {
      setPos({ x: e.clientX, y: e.clientY });
    }
  }, [visible]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <>
      <span
        onMouseEnter={show}
        onMouseLeave={hide}
        onMouseMove={move}
        className="cursor-help border-b border-dotted border-dnd-muted/50"
      >
        {children}
      </span>

      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] bg-dnd-surface border border-dnd-accent rounded-lg shadow-2xl p-4 w-80 max-h-96 overflow-y-auto pointer-events-none"
          style={{
            left: Math.min(pos.x + 12, window.innerWidth - 340),
            top: Math.min(pos.y + 12, window.innerHeight - 400),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-dnd-text">{spell.cn}</span>
            <span className="text-xs text-dnd-muted">{spell.en}</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="text-[10px] bg-dnd-primary/20 text-dnd-primary px-1.5 py-0.5 rounded">
              {LEVEL_LABELS[spell.level] || `${spell.level}环`}
            </span>
            <span className="text-[10px] bg-dnd-accent/20 text-dnd-accent px-1.5 py-0.5 rounded">
              {spell.school}
            </span>
            {spell.classes && (
              <span className="text-[10px] bg-dnd-muted/20 text-dnd-muted px-1.5 py-0.5 rounded">
                {spell.classes}
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs text-dnd-muted mb-2">
            <div><span className="text-dnd-text/70">施法时间：</span>{spell.castTime}</div>
            <div><span className="text-dnd-text/70">施法距离：</span>{spell.range}</div>
            <div><span className="text-dnd-text/70">法术成分：</span>{spell.components}</div>
            <div><span className="text-dnd-text/70">持续时间：</span>{spell.duration}</div>
          </div>
          <p className="text-xs text-dnd-text leading-relaxed whitespace-pre-line">{spell.desc}</p>
        </div>
      )}
    </>
  );
}

// Re-export for convenience
export type { SpellData };
