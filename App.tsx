import React, { useState } from 'react';
import ElectricCircuit from './components/ElectricCircuit';
import WaterCircuit from './components/WaterCircuit';
import PlaygroundSlide from './components/PlaygroundSlide';
import { DragHandleIcon } from './components/icons';

type SimulationVisibility = {
  electric: boolean;
  water: boolean;
  playground: boolean;
};

type SimulationKey = keyof SimulationVisibility;

const App: React.FC = () => {
  const [visibility, setVisibility] = useState<SimulationVisibility>({
    electric: true,
    water: true,
    playground: true,
  });
  
  const [simulationOrder, setSimulationOrder] = useState<SimulationKey[]>(['electric', 'water', 'playground']);
  const [draggedItem, setDraggedItem] = useState<SimulationKey | null>(null);
  const [dragOverItem, setDragOverItem] = useState<SimulationKey | null>(null);

  const handleVisibilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setVisibility(prev => ({ ...prev, [name]: checked }));
  };

  const orderedVisibleKeys = simulationOrder.filter(key => visibility[key]);
  const visibleCount = orderedVisibleKeys.length;
  const isSingleView = visibleCount === 1;

  const gridColsClass =
    visibleCount === 3
      ? 'lg:grid-cols-3'
      : visibleCount === 2
      ? 'lg:grid-cols-2'
      : '';

  const simulations: { [key in SimulationKey]: React.ReactElement } = {
    electric: <ElectricCircuit />,
    water: <WaterCircuit />,
    playground: <PlaygroundSlide />,
  };
  
  const simulationLabels: { [key in SimulationKey]: string } = {
    electric: 'מעגל חשמלי',
    water: 'מים',
    playground: 'מגלשה'
  }
  
  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, key: SimulationKey) => {
    e.stopPropagation();
    setDraggedItem(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, key: SimulationKey) => {
    e.preventDefault();
    if (draggedItem !== key) {
      setDragOverItem(key);
    }
  };
  
  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropKey: SimulationKey) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === dropKey) {
        setDraggedItem(null);
        setDragOverItem(null);
        return;
    }

    const newOrder = [...simulationOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const dropIndex = newOrder.indexOf(dropKey);

    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    setSimulationOrder(newOrder);
    setDraggedItem(null);
    setDragOverItem(null);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // The main layout is a CSS Grid to ensure header/footer are always visible.
  return (
    <div className="h-screen text-slate-200 p-4 sm:p-6 lg:p-8 font-sans grid grid-rows-[auto_auto_1fr_auto] gap-6">
      <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-cyan-300 tracking-tight drop-shadow-[0_2px_2px_rgba(0,255,255,0.3)]">הבנת זרם חשמלי: אנלוגיות</h1>
      </header>

      <div className="flex justify-center items-center gap-6 p-4 bg-black/30 backdrop-blur-sm rounded-xl max-w-2xl mx-auto border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-300">הצג סימולציות:</h3>
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center">
          {(Object.keys(visibility) as SimulationKey[]).map(key => (
            <label htmlFor={key} key={key} className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white transition-colors">
               <div className="relative">
                <input
                    type="checkbox"
                    id={key}
                    name={key}
                    checked={visibility[key]}
                    onChange={handleVisibilityChange}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </div>
              <span className="font-medium">
                {simulationLabels[key]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* The main content area grows to fill space and uses conditional rendering for layout */}
      <main className="min-h-0 overflow-y-auto">
        {isSingleView ? (
          <div className="w-full h-full max-w-5xl mx-auto">
            {orderedVisibleKeys.map(key => (
              <div key={key} className="w-full h-full">
                {simulations[key]}
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${gridColsClass} gap-8`}>
            {orderedVisibleKeys.map(key => {
              const isBeingDragged = draggedItem === key;
              const isDragTarget = dragOverItem === key;
              return (
                <div 
                  key={key} 
                  className={`relative w-full max-w-5xl mx-auto h-[80vh] max-h-[850px] transition-all duration-300 ${isBeingDragged ? 'opacity-40 scale-95' : 'opacity-100 scale-100'} ${isDragTarget ? 'ring-4 ring-cyan-400 rounded-2xl' : ''}`}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                >
                   <div
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragEnd={handleDragEnd}
                    className="absolute top-3 left-3 z-20 cursor-grab p-2 bg-slate-900/50 rounded-md hover:bg-slate-700/70 active:cursor-grabbing transition-colors"
                    aria-label="גרור כדי לסדר מחדש"
                  >
                    <DragHandleIcon className="w-6 h-6 text-slate-400" />
                  </div>
                  {simulations[key]}
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      <footer className="text-center text-slate-500">
        <p>פותח להדגמה חינוכית</p>
      </footer>
    </div>
  );
};

export default App;