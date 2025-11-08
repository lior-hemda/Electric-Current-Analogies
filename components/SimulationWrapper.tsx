import React from 'react';

interface SimulationWrapperProps {
  title: string;
  description: string;
  children: React.ReactNode;
  controls: React.ReactNode;
}

const SimulationWrapper: React.FC<SimulationWrapperProps> = ({ title, description, children, controls }) => {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden border border-cyan-400/30 h-full ring-2 ring-cyan-500/30">
      <div className="p-5 border-b border-slate-700/50 shadow-inner shadow-black/20 bg-black/20">
        <h2 className="text-2xl font-bold text-cyan-300 text-center drop-shadow-[0_1px_1px_rgba(0,255,255,0.2)]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1 text-center">{description}</p>
      </div>
      <div className="flex-grow min-h-0 p-4 flex items-center justify-center bg-black/30 relative overflow-hidden">
        <div className="relative w-full h-full">
            {children}
        </div>
      </div>
      <div className="p-5 bg-black/40 border-t border-slate-700/50">
        {controls}
      </div>
    </div>
  );
};

export default SimulationWrapper;