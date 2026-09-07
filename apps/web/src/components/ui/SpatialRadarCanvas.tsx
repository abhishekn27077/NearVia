import React, { useEffect, useRef } from "react";

interface SpatialRadarCanvasProps {
  className?: string;
  activeLocality?: string;
}

export const SpatialRadarCanvas: React.FC<SpatialRadarCanvasProps> = ({
  className = "",
  activeLocality = "MG Road",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio || 800);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio || 600);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio || 800;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio || 600;
    };

    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Nodes representing spatial opportunities within 5 km
    const nodeCount = 28;
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      x: 0.15 + Math.random() * 0.7,
      y: 0.15 + Math.random() * 0.7,
      z: Math.random() * 0.8 + 0.2,
      baseRadius: 2.5 + Math.random() * 3,
      pulseOffset: Math.random() * Math.PI * 2,
      color:
        i % 4 === 0
          ? "#10b981" // Emerald
          : i % 4 === 1
          ? "#14b8a6" // Teal
          : i % 4 === 2
          ? "#f59e0b" // Amber
          : "#06b6d4", // Cyan
      label: i % 5 === 0 ? "₹750" : i % 5 === 1 ? "₹1,200" : i % 5 === 2 ? "₹500" : "₹900",
    }));

    let radarAngle = 0;
    let pulseRadius = 0;

    const render = () => {
      // Lerp mouse coordinates for ultra-smooth 3D parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * (0.5 + (mouseRef.current.x - 0.5) * 0.08);
      const centerY = height * (0.5 + (mouseRef.current.y - 0.5) * 0.08);
      const maxRadius = Math.min(width, height) * 0.46;

      // 1. Draw 3D Perspective Concentric Distance Rings (1 km, 2 km, 3 km, 5 km)
      const ringDistances = [0.22, 0.45, 0.7, 1.0];
      const ringLabels = ["1 KM", "2 KM", "3.5 KM", "5 KM MAX"];

      ringDistances.forEach((ratio, idx) => {
        const r = maxRadius * ratio;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 3 ? "rgba(20, 184, 166, 0.35)" : "rgba(51, 65, 85, 0.22)";
        ctx.lineWidth = idx === 3 ? 1.5 : 1;
        if (idx === 3) {
          ctx.setLineDash([6, 6]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance indicator text
        ctx.fillStyle = idx === 3 ? "rgba(20, 184, 166, 0.7)" : "rgba(148, 163, 184, 0.35)";
        ctx.font = `${Math.max(10, Math.floor(width * 0.012))}px Inter, sans-serif`;
        ctx.fillText(ringLabels[idx], centerX + r + 6, centerY - 4);
      });

      // 2. Animated Concentric Radar Pulse Wave
      pulseRadius = (pulseRadius + 0.8) % maxRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(16, 185, 129, ${Math.max(0, 0.5 - pulseRadius / maxRadius)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Sweeping Radar Beam (Angle Scanner)
      radarAngle = (radarAngle + 0.018) % (Math.PI * 2);
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        maxRadius
      );
      gradient.addColorStop(0, "rgba(20, 184, 166, 0.25)");
      gradient.addColorStop(0.8, "rgba(20, 184, 166, 0.04)");
      gradient.addColorStop(1, "rgba(20, 184, 166, 0)");

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, maxRadius, radarAngle - 0.4, radarAngle);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // 4. Draw Opportunity Nodes with Floating 3D Parallax
      const time = Date.now() * 0.002;
      nodes.forEach((node) => {
        const offsetX = (mouseRef.current.x - 0.5) * 40 * node.z;
        const offsetY = (mouseRef.current.y - 0.5) * 40 * node.z;
        const nx = node.x * width + offsetX;
        const ny = node.y * height + offsetY;

        const distToCenter = Math.hypot(nx - centerX, ny - centerY);
        if (distToCenter > maxRadius) return;

        const pulse = Math.sin(time + node.pulseOffset) * 0.4 + 1;
        const currentRadius = node.baseRadius * pulse;

        // Glow outer
        ctx.beginPath();
        ctx.arc(nx, ny, currentRadius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}22`;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(nx, ny, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Micro Wage Tag Pill
        if (node.z > 0.5) {
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.strokeStyle = `${node.color}55`;
          ctx.lineWidth = 1;
          const tagW = 42;
          const tagH = 16;
          const tagX = nx + 8;
          const tagY = ny - 8;

          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = node.color;
          ctx.font = `bold ${Math.max(9, Math.floor(width * 0.011))}px Inter, sans-serif`;
          ctx.fillText(node.label, tagX + 5, tagY + 11);
        }
      });

      // 5. Center User Beacon (You Are Here)
      ctx.beginPath();
      ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(centerX, centerY, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center Locality Badge
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(11, Math.floor(width * 0.013))}px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${activeLocality} (Center)`, centerX, centerY + 28);
      ctx.textAlign = "start";

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [activeLocality]);

  return (
    <div className={`relative w-full h-full overflow-hidden pointer-events-none select-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
