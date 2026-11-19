'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  Minus,
  ArrowUpRight,
  Square,
  Circle,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Grid,
  Sparkles,
  Palette,
} from 'lucide-react';

export type DrawTool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'text';

export type BoardTheme = 'dark' | 'light' | 'dots' | 'grid';

export interface WhiteboardElement {
  id: string;
  tool: DrawTool;
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
  text?: string;
  author?: string;
}

interface WhiteboardCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  meetingTitle?: string;
  authorName?: string;
  elements: WhiteboardElement[];
  onAddElement: (el: WhiteboardElement) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
}

const STUDIO_COLORS = [
  '#FFFFFF',
  '#388BFF',
  '#FF7A00',
  '#10B981',
  '#F43F5E',
  '#FACC15',
  '#A855F7',
  '#06B6D4',
  '#111827',
];

const STROKE_SIZES = [2, 4, 8, 14];

function drawElementOnContext(
  ctx: CanvasRenderingContext2D,
  el: WhiteboardElement,
  boardBg: string
) {
  if (el.points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.tool === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size * 2.8;
  } else if (el.tool === 'eraser') {
    ctx.strokeStyle = boardBg;
    ctx.lineWidth = el.size * 3.2;
  } else {
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.size;
  }

  if (el.tool === 'pen' || el.tool === 'highlighter' || el.tool === 'eraser') {
    ctx.beginPath();
    if (el.points.length === 1) {
      ctx.arc(el.points[0].x, el.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length - 1; i++) {
        const midX = (el.points[i].x + el.points[i + 1].x) / 2;
        const midY = (el.points[i].y + el.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, midX, midY);
      }
      const last = el.points[el.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  } else if (el.tool === 'line' && el.points.length >= 2) {
    const start = el.points[0];
    const end = el.points[el.points.length - 1];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (el.tool === 'arrow' && el.points.length >= 2) {
    const start = el.points[0];
    const end = el.points[el.points.length - 1];
    const headLen = Math.max(12, el.size * 3.5);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - Math.PI / 6),
      end.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + Math.PI / 6),
      end.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  } else if (el.tool === 'rect' && el.points.length >= 2) {
    const start = el.points[0];
    const end = el.points[el.points.length - 1];
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (el.tool === 'circle' && el.points.length >= 2) {
    const start = el.points[0];
    const end = el.points[el.points.length - 1];
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.tool === 'text' && el.text) {
    ctx.font = `700 ${Math.max(16, el.size * 4)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = el.color;
    ctx.fillText(el.text, el.points[0].x, el.points[0].y);
  }

  ctx.restore();
}

export function WhiteboardCanvas({
  isOpen,
  onClose,
  meetingTitle = 'Live Studio',
  authorName = 'Participant',
  elements,
  onAddElement,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState<string>('#388BFF');
  const [strokeSize, setStrokeSize] = useState<number>(4);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('dark');
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftElement, setDraftElement] = useState<WhiteboardElement | null>(null);
  const [textPromptPos, setTextPromptPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');

  const boardBgColor = boardTheme === 'light' ? '#F8FAFC' : '#090f1d';

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Fill background
    ctx.fillStyle = boardBgColor;
    ctx.fillRect(0, 0, width, height);

    // Optional studio grid / dot patterns
    if (boardTheme === 'dots') {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      const step = 28;
      for (let x = step; x < width; x += step) {
        for (let y = step; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (boardTheme === 'grid') {
      ctx.strokeStyle = 'rgba(56, 139, 255, 0.1)';
      ctx.lineWidth = 1;
      const step = 32;
      ctx.beginPath();
      for (let x = 0; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // Draw committed elements
    for (const el of elements) {
      drawElementOnContext(ctx, el, boardBgColor);
    }

    // Draw active draft element
    if (draftElement) {
      drawElementOnContext(ctx, draftElement, boardBgColor);
    }

    ctx.restore();
  }, [elements, draftElement, boardBgColor, boardTheme]);

  // Handle responsive high-DPI canvas sizing
  useEffect(() => {
    if (!isOpen) return;
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      renderCanvas();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [isOpen, renderCanvas]);

  useEffect(() => {
    if (isOpen) {
      renderCanvas();
    }
  }, [isOpen, renderCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getPoint(e);
    if (tool === 'text') {
      setTextPromptPos(pt);
      setTextInput('');
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const newEl: WhiteboardElement = {
      id: `wb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tool,
      color: tool === 'eraser' ? boardBgColor : color,
      size: strokeSize,
      points: [pt],
      author: authorName,
    };
    setDraftElement(newEl);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !draftElement) return;
    const pt = getPoint(e);

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      setDraftElement((prev) =>
        prev ? { ...prev, points: [...prev.points, pt] } : null
      );
    } else {
      // Shapes keep start point + current end point
      setDraftElement((prev) =>
        prev ? { ...prev, points: [prev.points[0], pt] } : null
      );
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !draftElement) return;
    setIsDrawing(false);
    onAddElement(draftElement);
    setDraftElement(null);
  };

  const handleCommitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textPromptPos || !textInput.trim()) {
      setTextPromptPos(null);
      return;
    }
    const textEl: WhiteboardElement = {
      id: `wb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tool: 'text',
      color,
      size: strokeSize,
      points: [textPromptPos],
      text: textInput.trim(),
      author: authorName,
    };
    onAddElement(textEl);
    setTextPromptPos(null);
    setTextInput('');
  };

  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `MetroMeet-Whiteboard-${meetingTitle.replace(/[^a-z0-9]+/gi, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  const toolButtons: Array<{ id: DrawTool; icon: React.ReactNode; label: string }> = [
    { id: 'pen', icon: <PenTool className="h-4 w-4" />, label: 'Pen / Brush' },
    { id: 'highlighter', icon: <Highlighter className="h-4 w-4" />, label: 'Highlighter' },
    { id: 'line', icon: <Minus className="h-4 w-4" />, label: 'Line' },
    { id: 'arrow', icon: <ArrowUpRight className="h-4 w-4" />, label: 'Arrow' },
    { id: 'rect', icon: <Square className="h-4 w-4" />, label: 'Rectangle' },
    { id: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Circle' },
    { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text' },
    { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'Eraser' },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-[#050a14]/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-200">
      {/* Top Studio Header Bar */}
      <div className="h-14 px-4 sm:px-6 border-b border-white/[0.08] bg-[#091222]/95 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0066FF] to-[#FF7A00] flex items-center justify-center text-white shadow-lg shadow-[#0066FF]/30 shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white truncate">
                Live Collaborative Whiteboard
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {meetingTitle} • Draw, sketch &amp; brainstorm together in real time
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Board Background Switcher */}
          <button
            onClick={() =>
              setBoardTheme((prev) =>
                prev === 'dark'
                  ? 'dots'
                  : prev === 'dots'
                  ? 'grid'
                  : prev === 'grid'
                  ? 'light'
                  : 'dark'
              )
            }
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-gray-200 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Switch Canvas Surface"
          >
            <Grid className="h-3.5 w-3.5 text-[#388BFF]" />
            <span className="hidden sm:inline capitalize">{boardTheme} Board</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="h-7 w-7 rounded-lg hover:bg-white/[0.1] text-gray-300 hover:text-white disabled:opacity-30 flex items-center justify-center cursor-pointer transition-colors"
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="h-7 w-7 rounded-lg hover:bg-white/[0.1] text-gray-300 hover:text-white disabled:opacity-30 flex items-center justify-center cursor-pointer transition-colors"
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Export PNG */}
          <button
            onClick={handleDownloadPNG}
            className="px-3 py-1.5 rounded-xl bg-[#0066FF] hover:bg-[#1E78FF] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#0066FF]/30 transition-all cursor-pointer"
            title="Download Artwork as PNG"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save PNG</span>
          </button>

          {/* Clear Board */}
          <button
            onClick={onClear}
            className="h-8 w-8 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 flex items-center justify-center transition-all cursor-pointer"
            title="Clear Entire Board"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Close Whiteboard */}
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-gray-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Return to Meeting Stage"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Surface */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block touch-none cursor-crosshair"
        />

        {/* Inline Text Tool Floating Input */}
        {textPromptPos && (
          <form
            onSubmit={handleCommitText}
            style={{ left: textPromptPos.x, top: textPromptPos.y }}
            className="absolute z-50 -translate-y-1/2 flex items-center gap-1.5 p-1.5 rounded-xl bg-[#091222]/95 border border-[#0066FF]/60 shadow-2xl"
          >
            <input
              type="text"
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type text & press Enter..."
              className="bg-transparent text-xs font-bold text-white outline-none px-2 py-1 w-48"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-[#0066FF] text-white text-[11px] font-bold cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setTextPromptPos(null)}
              className="p-1 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        )}

        {/* Floating International-Standard Bottom Dock */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3.5 py-2.5 rounded-3xl bg-[#091222]/92 border border-white/[0.12] backdrop-blur-2xl shadow-2xl shadow-black/80">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1">
            {toolButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTool(btn.id)}
                title={btn.label}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  tool === btn.id
                    ? 'bg-gradient-to-tr from-[#0066FF] to-[#388BFF] text-white shadow-lg shadow-[#0066FF]/40 scale-105'
                    : 'text-gray-300 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {btn.icon}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-white/[0.12] hidden sm:block" />

          {/* Color Palette */}
          <div className="flex items-center gap-1.5">
            {STUDIO_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                }}
                style={{ backgroundColor: c }}
                className={`h-6 w-6 rounded-full border-2 transition-transform cursor-pointer ${
                  color === c && tool !== 'eraser'
                    ? 'border-white scale-125 shadow-md'
                    : 'border-white/25 hover:scale-110'
                }`}
                title={`Color ${c}`}
              />
            ))}
            <label
              className="h-6 w-6 rounded-full border border-white/30 bg-gradient-to-tr from-rose-500 via-amber-400 to-cyan-400 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform overflow-hidden"
              title="Custom Color"
            >
              <Palette className="h-3 w-3 text-black" />
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'eraser') setTool('pen');
                }}
                className="opacity-0 absolute w-0 h-0"
              />
            </label>
          </div>

          <div className="h-6 w-px bg-white/[0.12] hidden sm:block" />

          {/* Stroke Width Presets */}
          <div className="flex items-center gap-1.5">
            {STROKE_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setStrokeSize(s)}
                title={`Brush size ${s}px`}
                className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  strokeSize === s
                    ? 'bg-white/[0.15] border border-[#388BFF]'
                    : 'hover:bg-white/[0.08]'
                }`}
              >
                <span
                  className="rounded-full bg-white block"
                  style={{ width: Math.min(16, s + 3), height: Math.min(16, s + 3) }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
