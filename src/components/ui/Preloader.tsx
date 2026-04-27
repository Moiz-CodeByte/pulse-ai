import { useEffect, useState } from 'react';
import { AppLogo } from '@/components/ui/AppLogo';

export function Preloader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time or wait for app initialization
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-fadeIn">
      <div className="relative flex flex-col items-center gap-12">
        {/* Logo with heartbeat animation and glow */}
        <div className="relative">
          {/* Animated glow rings */}
          <div className="absolute inset-0 -m-8">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse-glow" />
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl animate-pulse-glow-delayed" />
          </div>
          
          {/* Main logo with heartbeat */}
          <div className="relative">
            <AppLogo className="h-24 w-24" animated />
          </div>
        </div>

        {/* Brand name */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground animate-fade-in-up">
            Pulse AI
          </h1>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Initializing cardiac analysis system...
          </p>
        </div>

        {/* Loading progress bar */}
        <div className="w-64 h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-loading-bar" />
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          10% {
            transform: scale(1.1);
          }
          20% {
            transform: scale(1);
          }
          30% {
            transform: scale(1.15);
          }
          40% {
            transform: scale(1);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }

        @keyframes pulseGlowDelayed {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.3);
          }
        }

        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out 0.3s both;
        }

        .animate-heartbeat {
          animation: heartbeat 2s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulseGlow 2s ease-in-out infinite;
        }

        .animate-pulse-glow-delayed {
          animation: pulseGlowDelayed 2s ease-in-out infinite 0.5s;
        }

        .animate-loading-bar {
          animation: loadingBar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
