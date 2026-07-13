'use client';

import { useEffect, useState } from 'react';

const LOADING_STEPS = [
  { label: 'Authenticating credentials',   icon: '🔐', duration: 600 },
  { label: 'Fetching secure workspace',    icon: '🏛️', duration: 700 },
  { label: 'Loading case intelligence',    icon: '⚖️', duration: 600 },
  { label: 'Connecting AI engine',         icon: '🤖', duration: 500 },
  { label: 'Ready',                        icon: '✅', duration: 300 },
];

interface Props {
  onComplete?: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let step = 0;
    const totalDuration = LOADING_STEPS.reduce((s, st) => s + st.duration, 0);
    let elapsed = 0;

    const advance = () => {
      if (step >= LOADING_STEPS.length) {
        setDone(true);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => onComplete?.(), 500);
        }, 400);
        return;
      }
      setCurrentStep(step);
      const stepDuration = LOADING_STEPS[step].duration;
      const startElapsed = elapsed;

      // Animate progress bar smoothly across this step
      const startProgress = (startElapsed / totalDuration) * 100;
      elapsed += stepDuration;
      const endProgress = (elapsed / totalDuration) * 100;

      // Micro-tick to update progress
      const tickInterval = 20;
      const ticks = stepDuration / tickInterval;
      let tick = 0;
      const ticker = setInterval(() => {
        tick++;
        const p = startProgress + ((endProgress - startProgress) * (tick / ticks));
        setProgress(Math.min(p, 99.9));
        if (tick >= ticks) clearInterval(ticker);
      }, tickInterval);

      step++;
      setTimeout(advance, stepDuration);
    };

    advance();
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#60A5FA" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8" style={{ width: 340 }}>
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              boxShadow: '0 0 40px rgba(99,102,241,0.5), 0 0 80px rgba(99,102,241,0.2)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            CI
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-white tracking-tight">CaseIntelix</div>
            <div className="text-xs font-medium mt-0.5" style={{ color: '#60A5FA' }}>Legal Intelligence Platform</div>
          </div>
        </div>

        {/* Steps */}
        <div className="w-full space-y-2.5">
          {LOADING_STEPS.map((step, i) => {
            const isActive = i === currentStep && !done;
            const isDone = i < currentStep || done;
            return (
              <div
                key={i}
                className="flex items-center gap-3 transition-all duration-300"
                style={{ opacity: isDone ? 0.7 : isActive ? 1 : 0.2 }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 transition-all duration-300"
                  style={{
                    background: isDone ? 'rgba(5,150,105,0.2)' : isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    border: isDone
                      ? '1.5px solid rgba(5,150,105,0.5)'
                      : isActive
                      ? '1.5px solid rgba(59,130,246,0.6)'
                      : '1.5px solid rgba(255,255,255,0.08)',
                    boxShadow: isActive ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
                  }}
                >
                  {isDone ? '✓' : isActive ? (
                    <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>◌</span>
                  ) : '○'}
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: isDone ? '#6EE7B7' : isActive ? '#BFDBFE' : '#475569' }}
                >
                  {step.label}
                </span>
                <span className="ml-auto text-base" style={{ opacity: isActive || isDone ? 1 : 0 }}>
                  {step.icon}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
              {done ? 'All systems ready' : 'Initializing workspace…'}
            </span>
            <span className="text-xs font-black" style={{ color: '#60A5FA' }}>
              {done ? '100' : Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: done ? '100%' : `${progress}%`,
                background: 'linear-gradient(90deg, #3B82F6, #6366F1)',
                boxShadow: '0 0 8px rgba(99,102,241,0.6)',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        </div>

        {/* Tagline */}
        <p className="text-xs text-center" style={{ color: '#334155' }}>
          Secured with end-to-end encryption · Attorney-client privilege protected
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.5), 0 0 80px rgba(99,102,241,0.2); }
          50%       { box-shadow: 0 0 60px rgba(99,102,241,0.7), 0 0 120px rgba(99,102,241,0.3); }
        }
      `}</style>
    </div>
  );
}
