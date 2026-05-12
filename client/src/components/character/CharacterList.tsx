import { useAuthStore } from '../../stores/authStore';

interface CharacterListProps {
  characters: any[];
  onSelect: (character: any) => void;
  onCreate?: () => void;
}

export default function CharacterList({ characters, onSelect, onCreate }: CharacterListProps) {
  const { user } = useAuthStore();

  return (
    <div className="p-4 space-y-2 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm text-dnd-muted">
          Characters ({characters.length})
        </h2>
        <button
          onClick={onCreate}
          className="text-xs bg-dnd-primary/20 text-dnd-primary px-2 py-1 rounded hover:bg-dnd-primary/30 transition-colors"
        >
          + Create
        </button>
      </div>
      {characters.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-dnd-muted px-4">
          <div className="w-12 h-12 bg-dnd-accent/30 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm">No characters in this campaign yet.</p>
        </div>
      )}
      {characters.map((char) => (
        <button
          key={char.id}
          onClick={() => onSelect(char)}
          className="w-full bg-dnd-bg hover:bg-dnd-accent/20 border border-dnd-accent/30 hover:border-dnd-primary rounded-lg p-3 text-left transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium block">{char.name}</span>
              <span className="text-xs text-dnd-muted">
                Lv{char.level} {char.race} {char.class}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-dnd-muted block">
                HP {char.hpCurrent}/{char.hpMax}
              </span>
              <span className="text-xs text-dnd-accent">AC {char.ac}</span>
            </div>
          </div>
          {char.userId === user?.id && (
            <span className="text-[10px] bg-dnd-primary/20 text-dnd-primary px-1.5 py-0.5 rounded mt-1 inline-block">
              Your Character
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
