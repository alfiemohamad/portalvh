import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';

interface QrisCanvasProps {
  title: string;
  accountInfo: string;
  seed: number;
  filename: string;
}

export function QrisCanvas({ title, accountInfo, seed, filename }: QrisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 240;
    const pad = 20;
    const cells = 25;
    const cellSize = (size - pad * 2) / cells;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size + 28);

    const drawFinder = (r: number, c: number) => {
      const x = pad + c * cellSize;
      const y = pad + r * cellSize;
      ctx.fillStyle = '#111827';
      ctx.fillRect(x, y, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = '#111827';
      ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize);
    };

    drawFinder(0, 0);
    drawFinder(0, cells - 7);
    drawFinder(cells - 7, 0);

    // Deterministic pseudo-random QR pattern
    let val = seed * 9301 + 49297;
    const nextRand = () => {
      val = (val * 9301 + 49297) % 233280;
      return val / 233280;
    };

    ctx.fillStyle = '#111827';
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= cells - 8;
        const inBottomLeft = r >= cells - 8 && c < 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;
        if (nextRand() > 0.48) {
          ctx.fillRect(
            pad + c * cellSize,
            pad + r * cellSize,
            Math.ceil(cellSize),
            Math.ceil(cellSize)
          );
        }
      }
    }

    // Bottom QRIS caption
    ctx.fillStyle = '#17251f';
    ctx.font = 'bold 11px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SATU QRIS UNTUK SEMUA', size / 2, size + 8);
    ctx.fillStyle = '#506457';
    ctx.font = '10px Roboto, sans-serif';
    ctx.fillText(title + ' · ' + accountInfo, size / 2, size + 22);
  }, [seed, title, accountInfo]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl border border-[#dce5df] bg-white p-3 shadow-xs">
        <canvas ref={canvasRef} width={240} height={268} className="w-[210px] h-auto rounded-lg" />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 rounded-full border border-[#ee4129] bg-white px-5 py-2.5 text-sm font-semibold text-[#ee4129] transition hover:bg-[#ee4129] hover:text-white cursor-pointer"
      >
        <Download className="w-4 h-4" />
        Download QR
      </button>
    </div>
  );
}
