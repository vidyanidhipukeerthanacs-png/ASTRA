import React, { useEffect, useRef } from 'react';

export const EarthGlobe: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationAngle = 0;
    let orbitAngle = 0;
    let astronautFloat = 0;

    // Fixed internal size for high-DPI rendering
    const size = 360;
    canvas.width = size;
    canvas.height = size;
    const radius = 100;
    const centerX = size / 2;
    const centerY = size / 2;

    // Procedural simplified continental map points for smooth sphere projection
    // Each landmass is a series of [lat, lon] clusters
    const continents: [number, number, number][] = [];
    // Africa / Europe
    for (let lat = -30; lat <= 60; lat += 6) {
      for (let lon = -15; lon <= 45; lon += 7) {
        if (lat < 35 && lon > 40) continue;
        continents.push([lat, lon, 7]);
      }
    }
    // Americas
    for (let lat = -50; lat <= 65; lat += 7) {
      for (let lon = -120; lon <= -40; lon += 8) {
        if (lat < 10 && lon < -80) continue;
        if (lat > 15 && lon > -70) continue;
        continents.push([lat, lon, 8]);
      }
    }
    // Asia / Oceania
    for (let lat = -35; lat <= 70; lat += 7) {
      for (let lon = 50; lon <= 150; lon += 8) {
        if (lat < -10 && lon < 110) continue;
        continents.push([lat, lon, 7.5]);
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      rotationAngle += 0.006;
      orbitAngle += 0.014;
      astronautFloat += 0.02;

      // 1. Soft atmospheric Rayleigh glow behind Earth
      const atmoGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.85,
        centerX,
        centerY,
        radius * 1.35
      );
      atmoGlow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      atmoGlow.addColorStop(0.35, 'rgba(6, 182, 212, 0.22)');
      atmoGlow.addColorStop(0.7, 'rgba(14, 116, 144, 0.08)');
      atmoGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = atmoGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Earth Base Sphere (Oceans)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();

      // Deep ocean gradient with spherical 3D shading
      const oceanGrad = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.35,
        5,
        centerX,
        centerY,
        radius
      );
      oceanGrad.addColorStop(0, '#1e40af'); // vibrant illuminated blue
      oceanGrad.addColorStop(0.5, '#0f2b6b'); // deep ocean
      oceanGrad.addColorStop(0.85, '#09183d'); // terminator shadow
      oceanGrad.addColorStop(1, '#040b1e'); // night rim
      ctx.fillStyle = oceanGrad;
      ctx.fill();

      // 3. Render rotating continents onto sphere
      ctx.fillStyle = '#10b981'; // vibrant lush landmass

      for (const [latDeg, lonDeg, ptRadius] of continents) {
        const lat = (latDeg * Math.PI) / 180;
        const currentLon = ((lonDeg + (rotationAngle * 180) / Math.PI) % 360) * (Math.PI / 180);

        // Orthographic projection:
        // x = R * cos(lat) * sin(lon)
        // y = -R * sin(lat)
        // z = R * cos(lat) * cos(lon) -> visible when z > 0
        const z = radius * Math.cos(lat) * Math.cos(currentLon);
        if (z > 0) {
          const x = centerX + radius * Math.cos(lat) * Math.sin(currentLon);
          const y = centerY - radius * Math.sin(lat);

          // Atmospheric perspective & spherical foreshortening
          const depthAlpha = Math.max(0.2, z / radius);
          const radScale = (ptRadius * (z / radius) * (radius - Math.hypot(x - centerX, y - centerY))) / radius;

          ctx.fillStyle = `rgba(16, 149, 106, ${depthAlpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1.5, radScale), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Cloud swirl layer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      for (let i = 0; i < 9; i++) {
        const cloudLon = (((i * 40 + rotationAngle * 120) % 360) * Math.PI) / 180;
        const cloudLat = (Math.sin(i * 1.7) * 45 * Math.PI) / 180;
        const z = radius * Math.cos(cloudLat) * Math.cos(cloudLon);
        if (z > 0) {
          const x = centerX + radius * Math.cos(cloudLat) * Math.sin(cloudLon);
          const y = centerY - radius * Math.sin(cloudLat);
          ctx.beginPath();
          ctx.ellipse(x, y, 16 * (z / radius), 7, Math.PI / 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Day/Night Spherical Terminator Shadow
      const shadowGrad = ctx.createLinearGradient(
        centerX - radius,
        centerY,
        centerX + radius,
        centerY + radius * 0.4
      );
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      shadowGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.0)');
      shadowGrad.addColorStop(0.75, 'rgba(3, 7, 18, 0.65)');
      shadowGrad.addColorStop(1, 'rgba(2, 4, 10, 0.92)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

      // Inner limb rim glow
      const limbGlow = ctx.createRadialGradient(
        centerX - radius * 0.4,
        centerY - radius * 0.4,
        radius * 0.75,
        centerX,
        centerY,
        radius
      );
      limbGlow.addColorStop(0, 'rgba(56, 189, 248, 0)');
      limbGlow.addColorStop(0.9, 'rgba(56, 189, 248, 0.35)');
      limbGlow.addColorStop(1, 'rgba(186, 230, 253, 0.7)');
      ctx.fillStyle = limbGlow;
      ctx.fill();

      ctx.restore();

      // 6. Tilted Elliptical Orbit Line
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-0.35); // tilt angle
      ctx.scale(1.0, 0.38); // ellipse aspect
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.52, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.32)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.restore();

      // 7. Small Orbiting Satellite
      // Position along tilted ellipse
      const satOrbitR = radius * 1.52;
      const tilt = -0.35;
      const unrotatedX = satOrbitR * Math.cos(orbitAngle);
      const unrotatedY = satOrbitR * 0.38 * Math.sin(orbitAngle);
      const satX = centerX + unrotatedX * Math.cos(tilt) - unrotatedY * Math.sin(tilt);
      const satY = centerY + unrotatedX * Math.sin(tilt) + unrotatedY * Math.cos(tilt);

      // Draw Satellite (gold bus, blue solar wings, beacon)
      ctx.save();
      ctx.translate(satX, satY);
      // Satellite bus
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-3, -3, 6, 6);
      // Solar panel wings (left and right)
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-10, -2, 6, 4);
      ctx.fillRect(4, -2, 6, 4);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-10, -2, 6, 4);
      ctx.strokeRect(4, -2, 6, 4);
      // Center gold core
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Transmission pulse
      const pulseR = 4 + (Math.sin(orbitAngle * 4) + 1) * 3;
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 - pulseR * 0.03})`;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 8. Tiny Floating Astronaut nearby
      const astroBaseX = centerX + radius * 1.38;
      const astroBaseY = centerY - radius * 0.65;
      const astroX = astroBaseX + Math.sin(astronautFloat) * 4;
      const astroY = astroBaseY + Math.cos(astronautFloat * 0.8) * 5;

      ctx.save();
      ctx.translate(astroX, astroY);
      ctx.rotate(Math.sin(astronautFloat * 0.5) * 0.12);

      // Backpack / Life support
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-6, -4, 4, 10);
      // Spacesuit torso & legs
      ctx.fillStyle = '#f8fafc';
      // Torso
      ctx.beginPath();
      ctx.roundRect(-3, -3, 7, 9, 2);
      ctx.fill();
      // Helmet
      ctx.beginPath();
      ctx.arc(0.5, -6, 3.8, 0, Math.PI * 2);
      ctx.fill();
      // Gold visor
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(1.2, -6, 2.2, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      // Arms floating
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2, -1);
      ctx.lineTo(-5, 3);
      ctx.moveTo(3, -1);
      ctx.lineTo(6, 2);
      // Legs
      ctx.moveTo(-1, 6);
      ctx.lineTo(-2, 11);
      ctx.moveTo(2, 6);
      ctx.lineTo(4, 10);
      ctx.stroke();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-80 h-80 sm:w-96 sm:h-96 mx-auto select-none pointer-events-none"
      aria-label="Realistic rotating Earth globe with soft blue atmosphere glow, orbiting satellite, and floating astronaut"
    >
      {/* Background Star field ambiance */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] rounded-full -z-10" />
      <canvas
        ref={canvasRef}
        className="w-full h-full drop-shadow-[0_0_35px_rgba(56,189,248,0.25)]"
      />
    </div>
  );
};
