import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, X, Volume2, VolumeX } from 'lucide-react';

export type FestiveType = 'diwali' | 'holi' | 'christmas' | 'eid';

interface FestiveAnimationOverlayProps {
  festivalType?: FestiveType;
  isActive?: boolean;
  className?: string;
  enableInteraction?: boolean;
  onFestivalChange?: (type: FestiveType) => void;
  showControls?: boolean;
  showSwitcher?: boolean; // Controls whether Diwali/Holi/Winter/Eid switcher buttons are shown (Admin setting)
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
  drag: number;
  type: 'spark' | 'ember' | 'ring' | 'star' | 'powder' | 'snow' | 'splash';
  flicker?: boolean;
  angle?: number;
  spin?: number;
  wobble?: number;
  wobbleSpeed?: number;
}

// Authentic celebratory color palettes
const DIWALI_COLORS = [
  '#FFD700', // Gold
  '#FFA500', // Warm Amber
  '#FF6B35', // Saffron Flare
  '#FF3366', // Festive Ruby
  '#FFDF73', // Champagne Sparkle
  '#FFE600', // Radiant Yellow
  '#FFFFFF', // White Flash
];

const HOLI_COLORS = [
  '#EC4899', // Gulal Pink
  '#F43F5E', // Rose Crimson
  '#F59E0B', // Marigold Yellow
  '#8B5CF6', // Gulal Violet
  '#06B6D4', // Turquoise Blue
  '#10B981', // Spring Green
  '#FB923C', // Saffron Orange
];

const CHRISTMAS_COLORS = [
  '#FFFFFF', // Pure Snow
  '#E0F2FE', // Ice Blue
  '#FDE047', // Golden Star
  '#F87171', // Berry Red
  '#4ADE80', // Pine Green
];

const EID_COLORS = [
  '#34D399', // Emerald
  '#10B981', // Deep Jade
  '#FBBF24', // Crescent Gold
  '#FDE68A', // Luminous Ivory
  '#FFFFFF', // Star White
];

export const FestiveAnimationOverlay: React.FC<FestiveAnimationOverlayProps> = ({
  festivalType = 'diwali',
  isActive = true,
  className = '',
  enableInteraction = true,
  onFestivalChange,
  showControls = true,
  showSwitcher = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastAutoBurstRef = useRef<number>(0);
  const [isAnimationEnabled, setIsAnimationEnabled] = useState(isActive);
  const [currentFestival, setCurrentFestival] = useState<FestiveType>(festivalType);
  const [showInteractiveTip, setShowInteractiveTip] = useState(true);

  // Sync prop changes
  useEffect(() => {
    setCurrentFestival(festivalType);
  }, [festivalType]);

  useEffect(() => {
    setIsAnimationEnabled(isActive);
  }, [isActive]);

  // Dismiss hint after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInteractiveTip(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentFestival]);

  // Sound effect simulation using subtle Web Audio synthesizer (silently falls back if blocked)
  const playFestiveSound = useCallback((type: FestiveType) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'diwali') {
        // Subtle crackle pop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      } else if (type === 'holi') {
        // Soft splash puff
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      } else {
        // Twinkle chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.18);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
      setTimeout(() => ctx.close().catch(() => {}), 300);
    } catch {
      // Audio autoplay restrictions or unsupported
    }
  }, []);

  // Spawn a Diwali Cracker Burst
  const spawnDiwaliBurst = useCallback((originX: number, originY: number, count = 22, isManual = false) => {
    const newParticles: Particle[] = [];

    // Shockwave ring for punchy feel
    newParticles.push({
      x: originX,
      y: originY,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#FFD700',
      alpha: 0.85,
      decay: 0.05,
      gravity: 0,
      drag: 1,
      type: 'ring',
    });

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = (isManual ? 3.5 : 2.5) + Math.random() * 4.5;
      const color = DIWALI_COLORS[Math.floor(Math.random() * DIWALI_COLORS.length)];
      const isStar = Math.random() > 0.6;

      newParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: isStar ? 3 + Math.random() * 2.5 : 2 + Math.random() * 2,
        color,
        alpha: 0.95,
        decay: 0.015 + Math.random() * 0.02,
        gravity: 0.07,
        drag: 0.965,
        type: isStar ? 'star' : 'spark',
        flicker: true,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
      });
    }

    // Additional floating embers
    for (let i = 0; i < 4; i++) {
      newParticles.push({
        x: originX + (Math.random() - 0.5) * 15,
        y: originY + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -0.5 - Math.random() * 1.5,
        size: 2 + Math.random() * 2,
        color: '#FFA500',
        alpha: 0.8,
        decay: 0.008 + Math.random() * 0.01,
        gravity: -0.02,
        drag: 0.98,
        type: 'ember',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.05,
      });
    }

    particlesRef.current.push(...newParticles);
    if (isManual) {
      playFestiveSound('diwali');
    }
  }, [playFestiveSound]);

  // Spawn a Holi Gulal Color Splash
  const spawnHoliSplash = useCallback((originX: number, originY: number, count = 20, isManual = false) => {
    const newParticles: Particle[] = [];
    const baseColors = [
      HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)],
      HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)],
    ];

    // Central watercolor bloom splash
    newParticles.push({
      x: originX,
      y: originY,
      vx: 0,
      vy: 0,
      size: isManual ? 18 : 12,
      color: baseColors[0],
      alpha: 0.55,
      decay: 0.025,
      gravity: 0,
      drag: 1,
      type: 'splash',
    });

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = (isManual ? 3 : 2) + Math.random() * 3.5;
      const color = baseColors[Math.floor(Math.random() * baseColors.length)];

      newParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5 + Math.random() * 5,
        color,
        alpha: 0.85,
        decay: 0.015 + Math.random() * 0.02,
        gravity: 0.04,
        drag: 0.95,
        type: 'powder',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.06,
      });
    }

    particlesRef.current.push(...newParticles);
    if (isManual) {
      playFestiveSound('holi');
    }
  }, [playFestiveSound]);

  // Spawn Christmas / Winter Snow & Stars
  const spawnWinterBurst = useCallback((originX: number, originY: number, isManual = false) => {
    const newParticles: Particle[] = [];
    const count = isManual ? 18 : 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      const color = CHRISTMAS_COLORS[Math.floor(Math.random() * CHRISTMAS_COLORS.length)];

      newParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3.5,
        color,
        alpha: 0.9,
        decay: 0.012 + Math.random() * 0.015,
        gravity: 0.03,
        drag: 0.97,
        type: 'snow',
        angle: Math.random() * Math.PI * 2,
        spin: 0.05,
      });
    }
    particlesRef.current.push(...newParticles);
    if (isManual) {
      playFestiveSound('christmas');
    }
  }, [playFestiveSound]);

  // Spawn Eid Starlight
  const spawnEidBurst = useCallback((originX: number, originY: number, isManual = false) => {
    const newParticles: Particle[] = [];
    const count = isManual ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 3;
      const color = EID_COLORS[Math.floor(Math.random() * EID_COLORS.length)];

      newParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 2,
        color,
        alpha: 0.9,
        decay: 0.015 + Math.random() * 0.02,
        gravity: 0.03,
        drag: 0.97,
        type: 'star',
        angle: Math.random() * Math.PI * 2,
        spin: 0.04,
      });
    }
    particlesRef.current.push(...newParticles);
    if (isManual) {
      playFestiveSound('eid');
    }
  }, [playFestiveSound]);

  // General burst dispatcher based on current festival
  const triggerBurst = useCallback(
    (x: number, y: number, isManual = false) => {
      if (currentFestival === 'diwali') {
        spawnDiwaliBurst(x, y, isManual ? 26 : 18, isManual);
      } else if (currentFestival === 'holi') {
        spawnHoliSplash(x, y, isManual ? 22 : 14, isManual);
      } else if (currentFestival === 'christmas') {
        spawnWinterBurst(x, y, isManual);
      } else if (currentFestival === 'eid') {
        spawnEidBurst(x, y, isManual);
      }
    },
    [currentFestival, spawnDiwaliBurst, spawnHoliSplash, spawnWinterBurst, spawnEidBurst]
  );

  // Resize canvas according to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for smooth performance
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main 60fps Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = (time: number) => {
      if (!isRunning) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Clear canvas with transparent clearRect
      ctx.clearRect(0, 0, width, height);

      // Periodic automatic ambient bursts (every 2.8 to 4.2 seconds) if animation enabled
      if (isAnimationEnabled && width > 0 && height > 0) {
        if (!lastAutoBurstRef.current || time - lastAutoBurstRef.current > 3200) {
          lastAutoBurstRef.current = time;
          // Pick a pleasant background location
          const autoX = width * (0.15 + Math.random() * 0.7);
          const autoY = height * (0.15 + Math.random() * 0.45);
          triggerBurst(autoX, autoY, false);
        }
      }

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply physics
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;

        // Wobble for embers and powder
        if (p.wobble !== undefined && p.wobbleSpeed !== undefined) {
          p.wobble += p.wobbleSpeed;
          p.x += Math.sin(p.wobble) * 0.4;
        }

        // Spin
        if (p.angle !== undefined && p.spin !== undefined) {
          p.angle += p.spin;
        }

        // Decay alpha
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

        if (p.type === 'ring') {
          // Expanding celebratory shockwave ring
          p.size += 2.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (p.type === 'splash') {
          // Soft watercolor gulal bloom
          p.size += 1.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.filter = 'blur(6px)';
          ctx.fill();
        } else if (p.type === 'powder') {
          // Soft organic gulal powder fleck
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = p.color;
          ctx.fill();
        } else if (p.type === 'star') {
          // Twinkling four-point festive sparkle star
          ctx.translate(p.x, p.y);
          if (p.angle !== undefined) ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;

          ctx.beginPath();
          const r = p.size * 1.5;
          ctx.moveTo(0, -r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.quadraticCurveTo(0, 0, 0, r);
          ctx.quadraticCurveTo(0, 0, -r, 0);
          ctx.quadraticCurveTo(0, 0, 0, -r);
          ctx.fill();
        } else if (p.type === 'snow') {
          // Crystalline winter snowflake particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#FFFFFF';
          ctx.fill();
        } else {
          // Default sparkler / ember dot with glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          if (p.flicker && Math.random() > 0.5) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
          }
          ctx.fill();
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isAnimationEnabled, triggerBurst]);

  // Handle user clicks / taps on the container to trigger playful interactive bursts
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enableInteraction || !isAnimationEnabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      triggerBurst(x, y, true);
    },
    [enableInteraction, isAnimationEnabled, triggerBurst]
  );

  // Touch event handler specifically for mobile browsers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!enableInteraction || !isAnimationEnabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.touches && e.touches.length > 0) {
        for (let i = 0; i < Math.min(e.touches.length, 3); i++) {
          const touch = e.touches[i];
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          triggerBurst(x, y, true);
        }
      }
    },
    [enableInteraction, isAnimationEnabled, triggerBurst]
  );

  const handleSelectFestival = (type: FestiveType) => {
    setCurrentFestival(type);
    if (onFestivalChange) {
      onFestivalChange(type);
    }
    // Fire a celebratory burst when user switches
    const canvas = canvasRef.current;
    if (canvas) {
      triggerBurst(canvas.clientWidth * 0.5, canvas.clientHeight * 0.35, true);
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      style={{ zIndex: 6, touchAction: 'pan-y' }}
    >
      {/* 60fps Hardware-Accelerated Canvas for Mobile & Desktop */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />

      {/* Interactive Touch/Click Catcher Area (Transparent, pointer-events-auto for mobile taps and desktop clicks) */}
      {enableInteraction && (
        <div
          onTouchStart={handleTouchStart}
          className="absolute inset-0 pointer-events-auto cursor-crosshair opacity-0"
          style={{ touchAction: 'pan-y' }}
          title={
            currentFestival === 'diwali'
              ? 'Tap to burst golden sparkler crackers!'
              : currentFestival === 'holi'
              ? 'Tap to splash vibrant Holi gulal colours!'
              : 'Tap to trigger celebratory sparkles!'
          }
        />
      )}

      {/* Minimal Festive Badge & Interactive Controls Bar */}
      {showControls && (
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {/* Festival Switcher Chips (Only shown if showSwitcher is true - e.g., in Admin or when explicitly enabled) */}
          {showSwitcher && (
            <div className="bg-white/90 backdrop-blur-md border border-[#EAE2D5] shadow-xs rounded-full p-0.5 sm:p-1 flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] font-semibold text-[#2C2420]">
              <button
                type="button"
                onClick={() => handleSelectFestival('diwali')}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                  currentFestival === 'diwali'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-2xs'
                    : 'text-[#6B5D55] hover:text-[#2C2420]'
                }`}
                title="Diwali Sparklers & Golden Crackers"
              >
                <span>🪔</span>
                <span className="inline sm:inline">Diwali</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFestival('holi')}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                  currentFestival === 'holi'
                    ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white font-bold shadow-2xs'
                    : 'text-[#6B5D55] hover:text-[#2C2420]'
                }`}
                title="Holi Colors & Gulal Splashes"
              >
                <span>🎨</span>
                <span className="inline sm:inline">Holi</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFestival('christmas')}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                  currentFestival === 'christmas'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-2xs'
                    : 'text-[#6B5D55] hover:text-[#2C2420]'
                }`}
                title="Winter Snow & Golden Stars"
              >
                <span>🎄</span>
                <span className="hidden sm:inline">Winter</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFestival('eid')}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                  currentFestival === 'eid'
                    ? 'bg-gradient-to-r from-emerald-700 to-amber-500 text-white font-bold shadow-2xs'
                    : 'text-[#6B5D55] hover:text-[#2C2420]'
                }`}
                title="Eid Mubarak Crescent Starlight"
              >
                <span>🌙</span>
                <span className="hidden sm:inline">Eid</span>
              </button>
            </div>
          )}

          {/* Animation Toggle Pill (Minimal & Respectful of User Preference) */}
          <button
            type="button"
            onClick={() => setIsAnimationEnabled(!isAnimationEnabled)}
            className={`p-1 sm:px-2.5 sm:py-1 rounded-full border text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer backdrop-blur-md shadow-xs ${
              isAnimationEnabled
                ? 'bg-amber-50/90 border-amber-300 text-amber-900'
                : 'bg-white/80 border-[#EAE2D5] text-[#7A6458]'
            }`}
            title={isAnimationEnabled ? 'Pause Festive Animation' : 'Resume Festive Animation'}
          >
            <Sparkles className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isAnimationEnabled ? 'text-amber-500 animate-spin' : 'text-[#7A6458]'}`} />
            <span className="inline">{isAnimationEnabled ? 'ON' : 'Paused'}</span>
          </button>
        </div>
      )}

      {/* Playful Floating Interactive Hint (Auto-dismisses) */}
      {showInteractiveTip && isAnimationEnabled && (
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#2C2420]/85 text-white backdrop-blur-md px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-medium tracking-wide flex items-center gap-1.5 sm:gap-2 shadow-lg border border-amber-400/30 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-[90%] truncate">
          <span className="text-amber-300">✨</span>
          <span className="truncate">
            {currentFestival === 'diwali'
              ? 'Tap anywhere for Diwali crackers!'
              : currentFestival === 'holi'
              ? 'Tap anywhere for Holi gulal colors!'
              : 'Tap anywhere for festive sparkles!'}
          </span>
          <button
            type="button"
            onClick={() => setShowInteractiveTip(false)}
            className="text-white/60 hover:text-white ml-1 p-0.5 rounded-full hover:bg-white/10 shrink-0"
            aria-label="Dismiss tip"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
