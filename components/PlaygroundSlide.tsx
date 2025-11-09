import React, { useState, useEffect, useRef, useCallback } from 'react';
import SimulationWrapper from './SimulationWrapper';
import { PlayIcon, PauseIcon, ResetIcon } from './icons';

interface Kid {
  id: number;
  progress: number;
}

const TOTAL_PATH_LENGTH = 1000;
const KID_COUNT = 15;
const INITIAL_SLIDE_HEIGHT = 50;
const INITIAL_SLIDE_WIDTH = 50;
const CROSSING_POINT = 450; // A point in the "running back" path for measurement.


// Update function signature to accept slideHeight
const getKidPosition = (progress: number, kidId: number, totalKids: number, width: number, slideHeight: number) => {
  // Distribute kids into parallel lanes
  const numLanes = Math.max(1, Math.floor(width / 25));
  const lane = kidId % numLanes;
  const offset = totalKids > 1 ? (lane - (numLanes - 1) / 2) * 12 : 0;

  const p = progress % TOTAL_PATH_LENGTH;
  
  // Calculate top Y position based on height
  const topY = 100 - (slideHeight / 100) * 80; // Range from 100 down to 20

  // Sliding down the Bézier curve
  if (p < 300) {
    const t = p / 300;

    // Control points for the curve, p0.y and p1.y are now dynamic
    const p0 = { x: 50, y: topY };
    const p1 = { x: 150, y: topY };
    const p2 = { x: 150, y: 200 };
    const p3 = { x: 250, y: 200 };

    const tInv = 1 - t;
    const x = tInv**3 * p0.x + 3 * tInv**2 * t * p1.x + 3 * tInv * t**2 * p2.x + t**3 * p3.x;
    const y = tInv**3 * p0.y + 3 * tInv**2 * t * p1.y + 3 * tInv * t**2 * p2.y + t**3 * p3.y;

    const dx = 3 * tInv**2 * (p1.x - p0.x) + 6 * tInv * t * (p2.x - p1.x) + 3 * t**2 * (p3.x - p2.x);
    const dy = 3 * tInv**2 * (p1.y - p0.y) + 6 * tInv * t * (p2.y - p1.y) + 3 * t**2 * (p3.y - p2.y);
    const mag = Math.sqrt(dx * dx + dy * dy);

    if (mag === 0) return { x, y };

    const normalX = -dy / mag;
    const normalY = dx / mag;

    return { x: x + offset * normalX, y: y + offset * normalY };
  }
  // Running back (horizontal)
  if (p < 600) {
    const runProgress = (p - 300) / 300;
    return { x: 250 - runProgress * 200, y: 200 + offset };
  }
  // Elevator up (vertical), path length is now dynamic
  if (p < 1000) {
    const elevatorProgress = (p - 600) / 400;
    return { x: 50 + offset, y: 200 - elevatorProgress * (200 - topY) };
  }
  return { x: 0, y: 0 };
};

const PlaygroundSlide: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideHeight, setSlideHeight] = useState(INITIAL_SLIDE_HEIGHT); // Renamed state
  const [slideWidth, setSlideWidth] = useState(INITIAL_SLIDE_WIDTH);
  const [measureRate, setMeasureRate] = useState(false);
  const [displayRate, setDisplayRate] = useState(0);

  const [kids, setKids] = useState<Kid[]>(() => {
      return Array.from({ length: KID_COUNT }, (_, i) => ({
        id: i,
        progress: (i / KID_COUNT) * TOTAL_PATH_LENGTH,
      }));
  });

  const animationFrameId = useRef<number | null>(null);
  const slideHeightRef = useRef(slideHeight);
  const slideWidthRef = useRef(slideWidth);
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
    slideHeightRef.current = slideHeight;
  }, [slideHeight]);

  useEffect(() => {
    slideWidthRef.current = slideWidth;
  }, [slideWidth]);


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
        setDisplayRate(rate);
        lastUiUpdateTimeRef.current = now;
    }

    const currentSlideHeight = slideHeightRef.current;
    const currentSlideWidth = slideWidthRef.current;
    const widthFactor = 0.2 + 0.8 * ((currentSlideWidth - 10) / 90);
    
    // Slide speed depends on height, elevator speed is constant
    const slideSpeed = (1.5 + (currentSlideHeight / 100) * 4) * widthFactor;
    const runSpeed = 2 * widthFactor;
    const elevatorSpeed = 3 * widthFactor;

    setKids(prevKids =>
      prevKids.map(k => {
        let speed = 0;
        const oldProgressMod = k.progress % TOTAL_PATH_LENGTH;

        if (oldProgressMod < 300) {
            speed = slideSpeed;
        } else if (oldProgressMod < 600) {
            speed = runSpeed;
        } else {
            speed = elevatorSpeed;
        }

        const newProgress = k.progress + speed;
        const newProgressMod = newProgress % TOTAL_PATH_LENGTH;
        
        if (measureRateRef.current) {
             if (oldProgressMod < CROSSING_POINT && newProgressMod >= CROSSING_POINT) {
                crossingsTimestampsRef.current.push(performance.now());
            }
        }

        return { ...k, progress: newProgress };
      })
    );
    animationFrameId.current = requestAnimationFrame(runSimulation);
  }, []); // Empty dependency array, uses ref for slideHeight

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
    setSlideHeight(INITIAL_SLIDE_HEIGHT); // Reset slideHeight
    setSlideWidth(INITIAL_SLIDE_WIDTH);
    setMeasureRate(false);
    setKids(
      Array.from({ length: KID_COUNT }, (_, i) => ({
        id: i,
        progress: (i / KID_COUNT) * TOTAL_PATH_LENGTH,
      }))
    );
  };
  
  const slideStrokeWidth = 8 + (slideWidth / 100) * 16;
  const elevatorShaftWidth = 16 + (slideWidth / 100) * 16;
  const elevatorPlatformWidth = 30 + (slideWidth / 100) * 30;
  
  // Calculate dynamic positions for SVG elements
  const topY = 100 - (slideHeight / 100) * 80; // Range from 100 down to 20
  const slidePath = `M 50 ${topY} C 150 ${topY}, 150 200, 250 200`;

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
      {/* Updated slider */}
      <div className="flex items-center space-x-3">
        <label htmlFor="slideHeight" className="font-medium text-sm whitespace-nowrap">גובה המגלשה</label>
        <input
          type="range"
          id="slideHeight"
          min="10" // Prevent zero height
          max="100"
          value={slideHeight}
          onChange={(e) => setSlideHeight(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-sm font-mono w-10 text-center">{slideHeight}</span>
      </div>
       <div className="flex items-center space-x-3">
        <label htmlFor="slideWidth" className="font-medium text-sm whitespace-nowrap">רוחב המגלשה</label>
        <input
          type="range"
          id="slideWidth"
          min="10"
          max="100"
          value={slideWidth}
          onChange={(e) => setSlideWidth(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="text-sm font-mono w-10 text-center">{slideWidth}</span>
      </div>
      <div className="flex items-center justify-center p-2 rounded-md mt-2 bg-slate-800/70">
        <label htmlFor="measureRateSlide" className="flex items-center justify-center space-x-3 cursor-pointer">
          <span className="font-medium text-sm whitespace-nowrap">מדוד קצב מעבר</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              id="measureRateSlide"
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
      title="אנלוגיית המגלשה"
      description="ילדים עולים במעלית, גולשים במגלשה ורצים חזרה לתחילת המעלית."
      controls={controls}
    >
      <svg viewBox="0 0 300 250" className="w-full h-full">
        <defs>
            <linearGradient id="abstractBgGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(51, 65, 85, 0.5)" strokeWidth="1"/>
            </pattern>
            <linearGradient id="slideMetalGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#9ca3af" />
                <stop offset="50%" stopColor="#f9fafb" />
                <stop offset="100%" stopColor="#9ca3af" />
            </linearGradient>
            <filter id="figureShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.4" />
            </filter>
        </defs>

        {/* Scenery */}
        <rect x="0" y="0" width="300" height="250" fill="url(#abstractBgGradient)" />
        <rect x="0" y="0" width="300" height="250" fill="url(#grid)" />
        
        <rect x="0" y="200" width="300" height="50" fill="#1e293b" />

        {/* Elevator Shaft (Dynamic Height) */}
        <rect x={50 - elevatorShaftWidth / 2 - 2} y={topY - 10} width={elevatorShaftWidth + 4} height={215 - topY} fill="#1e293b" rx="2"/>
        <rect x={50 - elevatorShaftWidth / 2} y={topY - 10} width={elevatorShaftWidth} height={215 - topY} fill="#475569" rx="2"/>


        {/* Slide (Dynamic Height) */}
        <path d={slidePath} stroke="#1e293b" strokeWidth={slideStrokeWidth + 4} fill="none" strokeLinecap="round" />
        <path d={slidePath} stroke="url(#slideMetalGradient)" strokeWidth={slideStrokeWidth} fill="none" strokeLinecap="round" />
        
        {/* "Kids" as abstract figures */}
        {kids.map(kid => {
          const { x, y } = getKidPosition(kid.progress, kid.id, kids.length, slideWidth, slideHeight);
          
          return (
            <g key={kid.id} transform={`translate(${x} ${y})`} filter="url(#figureShadow)">
                <circle cx="0" cy="-11" r="4" fill="#22c55e" />
                <rect x="-4" y="-7" width="8" height="9" rx="2" fill="#334155" />
                <rect x="-4" y="2" width="3" height="6" rx="1.5" fill="#475569" />
                <rect x="1" y="2" width="3" height="6" rx="1.5" fill="#475569" />
            </g>
          );
        })}

        {/* Elevator Platform (Dynamic Height) */}
        <rect x={50 - elevatorPlatformWidth / 2} y={topY - 2} width={elevatorPlatformWidth} height="6" fill="#334155" rx="2" />
        <rect x={50 - elevatorPlatformWidth / 2 + 1} y={topY - 2} width={elevatorPlatformWidth - 2} height="3" fill="#64748b" rx="1" />

        {/* Measurement Line and Readout */}
        {measureRate && (
            <g>
                <line x1="150" y1="190" x2="150" y2="215" stroke="#f472b6" strokeWidth="2" strokeDasharray="3 3" />
                <rect x="160" y="180" width="105" height="22" fill="rgba(0,0,0,0.7)" rx="4" />
                <text x="212" y="195" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                    {displayRate.toFixed(2)} ילדים/שנייה
                </text>
            </g>
        )}
      </svg>
    </SimulationWrapper>
  );
};

export default PlaygroundSlide;