import confetti from "canvas-confetti";

export const triggerCelebration = () => {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ["#14b8a6", "#10b981", "#f59e0b", "#38bdf8", "#a855f7"],
      disableForReducedMotion: true,
    });
  } catch {
    // Gracefully handle if canvas is unavailable
  }
};

export const triggerRewardConfetti = () => {
  try {
    const end = Date.now() + 1000;
    const colors = ["#10b981", "#0d9488", "#f59e0b"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
        disableForReducedMotion: true,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  } catch {
    // Graceful fallback
  }
};
