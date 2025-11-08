import React, { useState, useEffect, useRef, useCallback } from 'react';
import SimulationWrapper from './SimulationWrapper';
import { PlayIcon, PauseIcon, ResetIcon } from './icons';
import type { Particle } from '../types';

const TOTAL_PATH_LENGTH = 1000;
const PARTICLE_COUNT = 30;
const INITIAL_VOLTAGE = 50;
const INITIAL_WIRE_WIDTH = 50;
const CHARGE_PER_PARTICLE = 0.01; // Coulombs

const getParticlePosition = (progress: number, particleId: number, totalParticles: number, width: number, strokeWidth: number) => {
  const numLanes = Math.max(1, Math.floor(width / 20));
  const lane = particleId % numLanes;
  const offsetRange = strokeWidth * 0.7;
  const offset = totalParticles > 1 ? (lane - (numLanes - 1) / 2) * (offsetRange / numLanes) : 0;

  const p = progress % TOTAL_PATH_LENGTH;
  
  if (p < 250) { 
    const t = p / 250;
    return { x: 50 + t * 250, y: 50 + offset, angle: 0 };
  }
  if (p < 325) {
    const t = (p - 250) / 75;
    return { x: 300 + offset, y: 50 + t * 75, angle: 90 };
  }
  if (p < 425) {
    const t = (p - 325) / 100;
    return { x: 300 - t * 100, y: 125 + offset, angle: 180 };
  }
  if (p < 500) {
    const t = (p - 425) / 75;
    return { x: 200 + offset, y: 125 + t * 75, angle: 90 };
  }
  if (p < 750) {
    const t = (p - 500) / 250;
    return { x: 200 - t * 250, y: 200 + offset, angle: 180 };
  }
  if (p < 900) {
    const t = (p - 750) / 150;
    return { x: -50 + offset, y: 200 - t * 150, angle: 270 };
  }
  
  const t = (p - 900) / 100;
  return { x: -50 + t * 100, y: 50 + offset, angle: 0 };
};


const ElectricCircuit: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [voltage, setVoltage] = useState(INITIAL_VOLTAGE);
  const [wireWidth, setWireWidth] = useState(INITIAL_WIRE_WIDTH);
  const [measureRate, setMeasureRate] = useState(false);
  const [displayRate, setDisplayRate] = useState(0);

  const [particles, setParticles] = useState<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      progress: (i / PARTICLE_COUNT) * TOTAL_PATH_LENGTH,
    }));
  });

  const animationFrameId = useRef<number | null>(null);
  const particlesCrossed = useRef(0);
  const lastMeasureTime = useRef(performance.now());
  const measureRateRef = useRef(measureRate);

  useEffect(() => {
    measureRateRef.current = measureRate;
    if (!measureRate) {
      particlesCrossed.current = 0;
      lastMeasureTime.current = performance.now();
      setDisplayRate(0);
    }
  }, [measureRate]);


  const runSimulation = useCallback(() => {
    if (measureRateRef.current) {
        const now = performance.now();
        if (now - lastMeasureTime.current >= 1000) {
            setDisplayRate(particlesCrossed.current * CHARGE_PER_PARTICLE);
            particlesCrossed.current = 0;
            lastMeasureTime.current = now;
        }
    }

    setParticles(prevParticles => {
      const speed = (voltage / 100) * 4;
      return prevParticles.map(p => {
        const newProgress = p.progress + speed;
        if (measureRateRef.current) {
            if (p.progress % TOTAL_PATH_LENGTH > 900 && newProgress % TOTAL_PATH_LENGTH <= 900) {
                 particlesCrossed.current++;
            }
        }
        return { ...p, progress: newProgress };
      });
    });
    animationFrameId.current = requestAnimationFrame(runSimulation);
  }, [voltage]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameId.current = requestAnimationFrame(runSimulation);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, runSimulation]);

  const handleReset = () => {
    setIsPlaying(false);
    setVoltage(INITIAL_VOLTAGE);
    setWireWidth(INITIAL_WIRE_WIDTH);
    setMeasureRate(false);
    setParticles(
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        progress: (i / PARTICLE_COUNT) * TOTAL_PATH_LENGTH,
      }))
    );
  };
  
  const normalizedVoltage = voltage / 100;
  const normalizedWireWidth = wireWidth / 100;

  const filamentBrightness = 50 + normalizedVoltage * 45;
  const filamentColor = `hsl(50, 100%, ${filamentBrightness}%)`;
  const baseFilamentWidth = 1.5 + normalizedWireWidth * 3;
  const filamentStrokeWidth = baseFilamentWidth + normalizedVoltage * 3;

  const innerGlowOpacity = Math.pow(normalizedVoltage, 1.2) * 0.9;
  const innerGlowRadius = 15 + normalizedVoltage * 20;
  const outerGlowOpacity = Math.pow(normalizedVoltage, 1.7) * 0.7;
  const outerGlowRadius = 30 + normalizedVoltage * 30;
  
  const wireStrokeWidth = 4 + (wireWidth / 100) * 8;
  
  const mainPathD = "M 50 50 L 300 50 L 300 125 M 200 125 L 200 200 L -50 200 L -50 50 L 50 50";
  const bulbConnectorPathD = "M 300 125 L 265 150 M 200 125 L 235 150";

  const Wire3D = ({ d, width }: { d: string, width: number }) => (
    <>
      <path d={d} stroke="#1f2937" strokeWidth={width + 2} fill="none" strokeLinecap="round" strokeLinejoin='round' />
      <path d={d} stroke="url(#wire3DGradient)" strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin='round' />
      <path d={d} stroke="rgba(255,255,255,0.2)" strokeWidth={width/3} fill="none" strokeLinecap="round" strokeLinejoin='round' />
    </>
  );

  const controls = (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={() => setIsPlaying(p => !p)}
          className="p-3 bg-cyan-600/80 hover:bg-cyan-500 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-400 shadow-md shadow-black/30"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>
        <button
          onClick={handleReset}
          className="p-3 bg-rose-600/80 hover:bg-rose-500 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-rose-400 shadow-md shadow-black/30"
          aria-label="Reset"
        >
          <ResetIcon className="w-6 h-6" />
        </button>
      </div>
       <div className="flex items-center space-x-3">
        <label htmlFor="voltage" className="font-medium text-sm whitespace-nowrap">הפרש פוטנציאלים (V)</label>
        <input
          type="range"
          id="voltage"
          min="0"
          max="100"
          value={voltage}
          onChange={(e) => setVoltage(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-sm font-mono w-10 text-center">{voltage}</span>
      </div>
      <div className="flex items-center space-x-3">
        <label htmlFor="wireWidth" className="font-medium text-sm whitespace-nowrap">רוחב המוליך</label>
        <input
          type="range"
          id="wireWidth"
          min="10"
          max="100"
          value={wireWidth}
          onChange={(e) => setWireWidth(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-sm font-mono w-10 text-center">{wireWidth}</span>
      </div>
      <div className="flex items-center justify-center p-2 rounded-md mt-2 bg-slate-800/70">
        <label htmlFor="measureRateElectric" className="flex items-center justify-center space-x-3 cursor-pointer">
          <span className="font-medium text-sm whitespace-nowrap">מדוד קצב מעבר</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              id="measureRateElectric"
              checked={measureRate}
              onChange={(e) => setMeasureRate(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </div>
        </label>
      </div>
    </div>
  );

  return (
    <SimulationWrapper
      title="מעגל חשמלי"
      description="מטענים זורמים מסוללה דרך נורה, הגורמת לה להאיר."
      controls={controls}
    >
      <svg viewBox="-70 -20 440 280" className="w-full h-full">
        <defs>
          <linearGradient id="wire3DGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#718096" />
            <stop offset="50%" stopColor="#4a5568" />
            <stop offset="100%" stopColor="#2d3748" />
          </linearGradient>
           <filter id="plasmaGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="plasmaGradient">
            <stop offset="0%" stopColor="white" />
            <stop offset="40%" stopColor="#76e6ff" />
            <stop offset="100%" stopColor="#00a3c4" />
          </radialGradient>
          <linearGradient id="plasmaTailGradient">
            <stop offset="0%" stopColor="rgba(118, 230, 255, 0.8)" />
            <stop offset="100%" stopColor="rgba(118, 230, 255, 0)" />
          </linearGradient>
          <radialGradient id="bulbGlassGradient" cx="0.3" cy="0.3">
            <stop offset="0%" stopColor="rgba(209, 213, 229, 0.1)" />
            <stop offset="100%" stopColor="rgba(107, 114, 128, 0.4)" />
          </radialGradient>
           <filter id="bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
          </filter>
           <linearGradient id="batteryBodyGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#4a5568" />
            <stop offset="20%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#a0aec0" />
            <stop offset="80%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#4a5568" />
           </linearGradient>
        </defs>

        {/* Wires */}
        <Wire3D d={mainPathD} width={wireStrokeWidth} />
        <Wire3D d={bulbConnectorPathD} width={wireStrokeWidth} />

        {/* Battery */}
        <g transform="translate(-50, 50)">
          <rect x="-15" y="0" width="30" height="150" fill="#1f2937" rx="5" />
          <rect x="-13" y="2" width="26" height="146" fill="url(#batteryBodyGradient)" rx="3" />
          <rect x="-12" y="-5" width="24" height="10" fill="#334155" rx="2" />
          <rect x="-10" y="-8" width="20" height="6" fill="#f59e0b" rx="2" />
          <text x="0" y="25" textAnchor="middle" fill="#f59e0b" fontSize="24" fontWeight="bold">+</text>
          <text x="0" y="140" textAnchor="middle" fill="#60a5fa" fontSize="24" fontWeight="bold">-</text>
        </g>
        
        {/* Bulb */}
        <g transform="translate(250, 125)">
           {voltage > 1 && (
             <>
               <circle cx="0" cy="0" r={outerGlowRadius} fill={`rgba(251, 191, 36, ${outerGlowOpacity})`} filter="url(#bulbGlow)" />
               <circle cx="0" cy="0" r={innerGlowRadius} fill={`rgba(253, 224, 71, ${innerGlowOpacity})`} filter="url(#bulbGlow)" />
             </>
           )}
           {/* Screw base */}
           <rect x="-17" y="25" width="34" height="22" fill="#2d3748" rx="2" />
           <path d="M-17 30 h 34 M-17 35 h 34 M-17 40 h 34 M-17 45 h 34" stroke="#4a5568" strokeWidth="1.5" />
           <rect x="-15" y="27" width="30" height="18" fill="url(#wire3DGradient)" rx="1"/>
           
           {/* Glass */}
           <circle cx="0" cy="0" r="30" fill="url(#bulbGlassGradient)" stroke="#9ca3af" strokeWidth="1.5" />
           <path d="M-20 -20 A 30 30 0 0 1 20 -20" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none"/>
           
           {/* Internals */}
           <path d="M -25 0 L -10 25 M 25 0 L 10 25" stroke="#4b5563" strokeWidth="2" />
           <path d="M -25 0 C -10 -25, 10 25, 25 0" stroke={filamentColor} strokeWidth={filamentStrokeWidth} fill="none" strokeLinecap='round' />
        </g>
        
        {measureRate && (
            <g>
                <line x1="70" y1={50 - wireStrokeWidth-2} x2="70" y2={50 + wireStrokeWidth+2} stroke="#fde047" strokeWidth="2" strokeDasharray="3 3" />
                <rect x="80" y="20" width="95" height="22" fill="rgba(0,0,0,0.7)" rx="4" />
                <text x="127" y="35" textAnchor="middle" fill="#fde047" fontSize="12" fontWeight="bold">
                    {displayRate.toFixed(3)} C/s
                </text>
            </g>
        )}

        {particles.map(p => {
          const { x, y, angle } = getParticlePosition(p.progress, p.id, particles.length, wireWidth, wireStrokeWidth);
          return (
             <g key={p.id} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path d="M 0,0 L -12,3 Q -8,0 -12,-3 Z" fill="url(#plasmaTailGradient)" />
              <g filter="url(#plasmaGlow)">
                  <circle r="4.5" fill="url(#plasmaGradient)" />
              </g>
            </g>
          );
        })}
      </svg>
    </SimulationWrapper>
  );
};

export default ElectricCircuit;