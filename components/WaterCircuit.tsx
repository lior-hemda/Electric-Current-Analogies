import React, { useState, useEffect, useRef, useCallback } from 'react';
import SimulationWrapper from './SimulationWrapper';
import { PlayIcon, PauseIcon, ResetIcon } from './icons';
import type { Particle } from '../types';

const TOTAL_PATH_LENGTH = 1000;
const PARTICLE_COUNT = 40;
const INITIAL_HEIGHT_DIFFERENCE = 50;
const INITIAL_PIPE_WIDTH = 50;
const VOLUME_PER_PARTICLE = 0.05; // Liters
const CROSSING_POINT = 450; // A point in the suction pipe for measurement.

const getParticlePosition = (progress: number, particleId: number, totalParticles: number, width: number, strokeWidth: number, heightDifference: number) => {
    const topY = 180 - (heightDifference / 100) * 140;
    const topReservoirOutletY = topY + 30;
    const bottomReservoirY = 300;
    
    const numLanes = Math.max(1, Math.floor(width / 25));
    const lane = particleId % numLanes;
    const offsetRange = strokeWidth * 0.8;
    const offset = totalParticles > 1 ? (lane - (numLanes - 1) / 2) * (offsetRange / numLanes) : 0;
    
    const p = progress % TOTAL_PATH_LENGTH;

    const P_TOP_OUTLET = { x: 180, y: topReservoirOutletY };
    const P_TURBINE = { x: 150, y: 240 };
    const P_BOTTOM_INLET = { x: 70, y: bottomReservoirY };
    const P_BOTTOM_OUTLET = { x: 20, y: bottomReservoirY };
    const P_PUMP_INLET = { x: 20, y: 220 };
    const P_TOP_INLET = { x: 180, y: topY };


    const calculatePosition = (start: {x:number, y:number}, end: {x:number, y:number}, prog: number) => {
      const x = start.x + (end.x - start.x) * prog;
      const y = start.y + (end.y - start.y) * prog;
      
      const vecX = end.x - start.x;
      const vecY = end.y - start.y;
      const mag = Math.sqrt(vecX*vecX + vecY*vecY) || 1;
      const normalX = vecY / mag;
      const normalY = -vecX / mag;
      return { x: x + offset * normalX, y: y + offset * normalY };
    }

    if (p < 200) { return calculatePosition(P_TOP_OUTLET, P_TURBINE, p / 200); }
    if (p < 350) { return calculatePosition(P_TURBINE, P_BOTTOM_INLET, (p - 200) / 150); }
    if (p < 400) { return { x: P_BOTTOM_INLET.x, y: P_BOTTOM_INLET.y }; }
    if (p < 500) { return calculatePosition(P_BOTTOM_OUTLET, P_PUMP_INLET, (p - 400) / 100); }
    if (p < 750) { return calculatePosition(P_PUMP_INLET, { x: 20, y: topY }, (p - 500) / 250); }
    if (p < 950) { return calculatePosition({ x: 20, y: topY }, P_TOP_INLET, (p - 750) / 200); }
    return { x: P_TOP_INLET.x, y: P_TOP_INLET.y };
};

const WaterCircuit: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [heightDifference, setHeightDifference] = useState(INITIAL_HEIGHT_DIFFERENCE);
  const [pipeWidth, setPipeWidth] = useState(INITIAL_PIPE_WIDTH);
  const [turbineRotation, setTurbineRotation] = useState(0);
  const [measureRate, setMeasureRate] = useState(false);
  const [displayRate, setDisplayRate] = useState(0);

  const [particles, setParticles] = useState<Particle[]>(() => 
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      progress: (i / PARTICLE_COUNT) * TOTAL_PATH_LENGTH,
    }))
  );
  
  const animationFrameId = useRef<number | null>(null);
  const heightDifferenceRef = useRef(heightDifference);
  const pipeWidthRef = useRef(pipeWidth);
  const crossingsTimestampsRef = useRef<number[]>([]);
  const lastUiUpdateTimeRef = useRef(0);
  const measureRateRef = useRef(measureRate);

  useEffect(() => {
    measureRateRef.current = measureRate;
    if (!measureRate) {
      crossingsTimestampsRef.current = [];
      setDisplayRate(0);
    } else {
      crossingsTimestampsRef.current = [];
      lastUiUpdateTimeRef.current = performance.now();
    }
  }, [measureRate]);

  useEffect(() => {
    heightDifferenceRef.current = heightDifference;
  }, [heightDifference]);

  useEffect(() => {
    pipeWidthRef.current = pipeWidth;
  }, [pipeWidth]);
  

  const runSimulation = useCallback(() => {
    const now = performance.now();

    // Update UI display at a throttled rate using a rolling average
    if (measureRateRef.current && now - lastUiUpdateTimeRef.current > 100) {
        const fiveSecondsAgo = now - 5000;
        const recentTimestamps = crossingsTimestampsRef.current.filter(t => t >= fiveSecondsAgo);
        crossingsTimestampsRef.current = recentTimestamps;

        let rate = 0;
        if (recentTimestamps.length > 1) {
            const timeSpanSeconds = (recentTimestamps[recentTimestamps.length - 1] - recentTimestamps[0]) / 1000;
            if (timeSpanSeconds > 0) {
                rate = (recentTimestamps.length - 1) / timeSpanSeconds;
            }
        }
        setDisplayRate(rate * VOLUME_PER_PARTICLE);
        lastUiUpdateTimeRef.current = now;
    }
    
    const currentHeightDifference = heightDifferenceRef.current;
    const currentPipeWidth = pipeWidthRef.current;
    const widthFactor = 0.2 + 0.8 * ((currentPipeWidth - 10) / 90);

    const pumpSpeed = 3 * widthFactor; 
    const gravitySpeed = (0.5 + (currentHeightDifference / 100) * 4) * widthFactor;

    setParticles(currentParticles => {
      let shouldTurbineSpin = false;
      
      const newParticles = currentParticles.map(p => {
        const currentProgressMod = p.progress % TOTAL_PATH_LENGTH;
        let speed = (currentProgressMod < 350) ? gravitySpeed : pumpSpeed;

        const oldProgressMod = p.progress % TOTAL_PATH_LENGTH;
        const newProgress = p.progress + speed;
        const newProgressMod = newProgress % TOTAL_PATH_LENGTH;

        if (measureRateRef.current) {
            if (oldProgressMod < CROSSING_POINT && newProgressMod >= CROSSING_POINT) {
                crossingsTimestampsRef.current.push(performance.now());
            }
        }

        if (currentProgressMod < 350 && gravitySpeed > 0.1) shouldTurbineSpin = true;
        return { ...p, progress: newProgress };
      });
      
      if (shouldTurbineSpin) {
          setTurbineRotation(r => (r + gravitySpeed * 2) % 360);
      }
      return newParticles;
    });

    animationFrameId.current = requestAnimationFrame(runSimulation);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      animationFrameId.current = requestAnimationFrame(runSimulation);
    } else {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isPlaying, runSimulation]);

  const handleReset = () => {
    setIsPlaying(false);
    setHeightDifference(INITIAL_HEIGHT_DIFFERENCE);
    setPipeWidth(INITIAL_PIPE_WIDTH);
    setTurbineRotation(0);
    setMeasureRate(false);
    setParticles(
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        progress: (i / PARTICLE_COUNT) * TOTAL_PATH_LENGTH,
      }))
    );
  };
  
  const pipeStrokeWidth = 8 + (pipeWidth / 100) * 12;
  const topY = 180 - (heightDifference / 100) * 140;
  const topReservoirY = topY;
  const topReservoirOutletY = topY + 30;
  const bottomReservoirY = 300;

  const gravityPipePath = `M 180 ${topReservoirOutletY} L 150 240 L 70 ${bottomReservoirY}`;
  const suctionPipePath = `M 20 ${bottomReservoirY} L 20 220`;
  const pumpAndTopPipePath = `M 20 220 L 20 ${topY} L 180 ${topY}`;


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
        <label htmlFor="heightDifference" className="font-medium text-sm whitespace-nowrap">הפרש גבהים</label>
        <input
          type="range"
          id="heightDifference"
          min="10"
          max="100"
          value={heightDifference}
          onChange={(e) => setHeightDifference(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-sm font-mono w-10 text-center">{heightDifference}</span>
      </div>
       <div className="flex items-center space-x-3">
        <label htmlFor="pipeWidth" className="font-medium text-sm whitespace-nowrap">רוחב הצינור</label>
        <input
          type="range"
          id="pipeWidth"
          min="10"
          max="100"
          value={pipeWidth}
          onChange={(e) => setPipeWidth(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-sm font-mono w-10 text-center">{pipeWidth}</span>
      </div>
      <div className="flex items-center justify-center p-2 rounded-md mt-2 bg-slate-800/70">
        <label htmlFor="measureRateWater" className="flex items-center justify-center space-x-3 cursor-pointer">
          <span className="font-medium text-sm whitespace-nowrap">מדוד קצב מעבר</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              id="measureRateWater"
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
      title="אנלוגיית המים"
      description="הפרש גבהים גורם למים לזרום למטה ולהניע טורבינה. משאבה מחזירה אותם למעלה."
      controls={controls}
    >
        <svg viewBox="0 0 300 350" className="w-full h-full">
            <defs>
              <linearGradient id="pipeMetalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6b7280" />
                  <stop offset="50%" stopColor="#d1d5db" />
                  <stop offset="100%" stopColor="#6b7280" />
              </linearGradient>
              <radialGradient id="waterParticleGradient">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.8)" />
                <stop offset="100%" stopColor="rgba(56, 189, 248, 0.5)" />
              </radialGradient>
               <linearGradient id="waterSurfaceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(14, 165, 233, 0.6)" />
                <stop offset="100%" stopColor="rgba(2, 132, 199, 0.8)" />
               </linearGradient>
            </defs>

            <path d={gravityPipePath} stroke="#1e293b" strokeWidth={pipeStrokeWidth + 4} fill="none" strokeLinecap="round"/>
            <path d={suctionPipePath} stroke="#1e293b" strokeWidth={pipeStrokeWidth + 4} fill="none" strokeLinecap="round"/>
            <path d={pumpAndTopPipePath} stroke="#1e293b" strokeWidth={pipeStrokeWidth + 4} fill="none" strokeLinecap="round"/>

            <path d={gravityPipePath} stroke="url(#pipeMetalGradient)" strokeWidth={pipeStrokeWidth} fill="none" strokeLinecap="round"/>
            <path d={suctionPipePath} stroke="url(#pipeMetalGradient)" strokeWidth={pipeStrokeWidth} fill="none" strokeLinecap="round"/>
            <path d={pumpAndTopPipePath} stroke="url(#pipeMetalGradient)" strokeWidth={pipeStrokeWidth} fill="none" strokeLinecap="round"/>
            
            {particles.map(p => {
                const progress = p.progress % TOTAL_PATH_LENGTH;
                const isInReservoir = (progress >= 350 && progress < 400) || progress >= 950;
                if (isInReservoir) return null;
                const { x, y } = getParticlePosition(p.progress, p.id, particles.length, pipeWidth, pipeStrokeWidth, heightDifference);
                return <g key={p.id} transform={`translate(${x}, ${y})`}>
                  <circle r="6" fill="#0284c7" opacity="0.8"/>
                  <circle r="3" fill="url(#waterParticleGradient)" />
                </g>
            })}
            
            <g>
              <rect x="180" y={topReservoirY} width="80" height="30" fill="rgba(14, 165, 233, 0.2)" stroke="#60a5fa" strokeWidth="1.5" rx="5" />
              <rect x="182" y={topReservoirY + 2} width="76" height="26" fill="url(#waterSurfaceGradient)" rx="3" />
              <text x="220" y={topReservoirY - 5} textAnchor="middle" fontSize="10" fill="#93c5fd" className="font-semibold">מאגר עליון</text>
            </g>
            <g>
              <rect x="20" y={bottomReservoirY} width="80" height="30" fill="rgba(14, 165, 233, 0.2)" stroke="#60a5fa" strokeWidth="1.5" rx="5" />
              <rect x="22" y={bottomReservoirY + 2} width="76" height="26" fill="url(#waterSurfaceGradient)" rx="3" />
              <text x="60" y={bottomReservoirY - 5} textAnchor="middle" fontSize="10" fill="#93c5fd" className="font-semibold">מאגר תחתון</text>
            </g>

            <g transform="translate(20, 220)">
              <circle cx="0" cy="0" r="20" fill="#2d3748" />
              <circle cx="0" cy="0" r="18" fill="url(#pipeMetalGradient)" />
              <circle cx="0" cy="0" r="15" fill="#2d3748" />
              <circle cx="0" cy="0" r="13" fill="#4a5568" />
              <g transform={`rotate(${-turbineRotation * 2.5})`}>
                  {[0, 90, 180, 270].map(angle => (
                      <path key={angle} d="M 0 2 C 5 4, 8 8, 10 12 L 8 11 C 6 8, 4 5, 0 3 Z" fill="#9ca3af" transform={`rotate(${angle})`} />
                  ))}
              </g>
              <circle cx="0" cy="0" r="3" fill="#1a202c" />
            </g>

            <g transform="translate(150, 240)">
                <circle cx="0" cy="0" r="22" fill="#1e293b" />
                <circle cx="0" cy="0" r="20" fill="url(#pipeMetalGradient)" />
                <circle cx="0" cy="0" r="17" fill="#1e293b" />
                <g transform={`rotate(${turbineRotation})`}>
                  {[0, 60, 120, 180, 240, 300].map(angle => (
                    <path key={angle} d="M 0 -4 L 15 -8 C 16 0 15 8 0 4 Z" fill="#facc15" transform={`rotate(${angle})`}/>
                  ))}
                </g>
                <circle cx="0" cy="0" r="5" fill="#eab308" stroke="#f59e0b" strokeWidth="1"/>
            </g>

            {measureRate && (
              <g>
                  <line x1={20 - pipeStrokeWidth-2} y1="260" x2={20 + pipeStrokeWidth+2} y2="260" stroke="#fde047" strokeWidth="2" strokeDasharray="3 3" />
                  <rect x="30" y="250" width="85" height="22" fill="rgba(0,0,0,0.7)" rx="4" />
                  <text x="72" y="265" textAnchor="middle" fill="#fde047" fontSize="12" fontWeight="bold">
                      {displayRate.toFixed(2)} L/s
                  </text>
              </g>
            )}
        </svg>
    </SimulationWrapper>
  );
};

export default WaterCircuit;