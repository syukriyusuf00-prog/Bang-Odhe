import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Crop,
  Grid3X3,
  ImagePlus,
  Loader2,
  Maximize2,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AspectRatioOption, CropFrameBox, MediaSlotConfig, MediaSlotId } from '../types';
import { VALIDATION_LIMITS } from '../types';

interface PhotoCropEditorModalProps {
  isOpen: boolean;
  slotId: MediaSlotId;
  slotTitle: string;
  defaultImageUrl?: string;
  currentConfig?: MediaSlotConfig;
  isAdmin: boolean;
  onAdminSignIn: () => Promise<void>;
  onClose: () => void;
  onSave: (config: MediaSlotConfig, publishToCloud: boolean) => Promise<void>;
  onResetToDefault: (slotId: MediaSlotId) => Promise<void>;
}

const ASPECT_PRESETS: Array<{ id: AspectRatioOption; label: string; ratio: number | null }> = [
  { id: 'free', label: 'Bebas', ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
];

type DragMode =
  | null
  | 'pan'
  | 'move-box'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  | 'resize-n'
  | 'resize-s'
  | 'resize-w'
  | 'resize-e';

function getPresetCropBox(
  aspect: AspectRatioOption,
  stageW: number,
  stageH: number
): CropFrameBox {
  const preset = ASPECT_PRESETS.find((p) => p.id === aspect);
  if (!preset || preset.ratio === null || stageW <= 0 || stageH <= 0) {
    return { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };
  }
  const targetRatio = preset.ratio;
  const maxW = stageW * 0.88;
  const maxH = stageH * 0.88;
  let boxW = maxW;
  let boxH = boxW / targetRatio;
  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * targetRatio;
  }
  const normW = Math.min(0.94, Math.max(0.18, boxW / stageW));
  const normH = Math.min(0.94, Math.max(0.18, boxH / stageH));
  return {
    x: (1 - normW) / 2,
    y: (1 - normH) / 2,
    width: normW,
    height: normH,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function PhotoCropEditorModal({
  isOpen,
  slotId,
  slotTitle,
  defaultImageUrl,
  currentConfig,
  isAdmin,
  onAdminSignIn,
  onClose,
  onSave,
  onResetToDefault,
}: PhotoCropEditorModalProps) {
  const defaultAspect: AspectRatioOption = slotId === 'hero_portrait' ? '4:5' : '16:9';

  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(defaultAspect);
  const [cropBox, setCropBox] = useState<CropFrameBox>({ x: 0.08, y: 0.08, width: 0.84, height: 0.84 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 440,
  });

  const dragRef = useRef<{
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    startBox: CropFrameBox;
  }>({
    mode: null,
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startBox: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
  });

  // Initialize editor state when opening modal
  useEffect(() => {
    if (!isOpen) return;
    setSaveError('');
    setImageError('');
    const initialUrl =
      currentConfig?.originalDataUrl ||
      currentConfig?.imageDataUrl ||
      defaultImageUrl ||
      '';
    setSourceUrl(initialUrl);
    const nextAspect = currentConfig?.aspectRatio ?? defaultAspect;
    setAspectRatio(nextAspect);
    setZoom(currentConfig?.zoom ?? 1);
    setOffsetX(currentConfig?.offsetX ?? 0);
    setOffsetY(currentConfig?.offsetY ?? 0);
    setRotation(currentConfig?.rotation ?? 0);
    if (currentConfig?.cropBox) {
      setCropBox(currentConfig.cropBox);
    } else {
      setCropBox(getPresetCropBox(nextAspect, stageSize.width, stageSize.height));
    }
  }, [isOpen, slotId, currentConfig, defaultImageUrl, defaultAspect]);

  // Measure interactive stage responsively
  useEffect(() => {
    if (!isOpen) return;
    const node = stageRef.current;
    if (!node) return;
    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen]);

  // Recalculate preset box cleanly when stage dimensions change and aspect is locked
  useEffect(() => {
    if (!isOpen || aspectRatio === 'free' || currentConfig?.cropBox) return;
    setCropBox(getPresetCropBox(aspectRatio, stageSize.width, stageSize.height));
  }, [stageSize.width, stageSize.height, aspectRatio, isOpen, currentConfig?.cropBox]);

  // Load image object whenever sourceUrl changes
  useEffect(() => {
    if (!sourceUrl) {
      setLoadedImage(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) {
        setLoadedImage(img);
        setImageError('');
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setLoadedImage(null);
        setImageError('Foto tidak dapat dimuat. Silakan unggah file gambar JPG, PNG, atau WebP.');
      }
    };
    img.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  // Compute exact shared transform parameters (used by both live canvas AND export canvas!)
  const getTransformGeometry = useCallback(
    (img: HTMLImageElement, stageW: number, stageH: number) => {
      const swapped = rotation === 90 || rotation === 270;
      const effW = swapped ? img.naturalHeight : img.naturalWidth;
      const effH = swapped ? img.naturalWidth : img.naturalHeight;
      const baseScale = Math.min((stageW * 0.9) / effW, (stageH * 0.9) / effH);
      const drawScale = baseScale * zoom;
      const tx = (offsetX / 100) * (stageW * 0.5);
      const ty = (offsetY / 100) * (stageH * 0.5);
      return { drawScale, tx, ty };
    },
    [rotation, zoom, offsetX, offsetY]
  );

  // Render live WYSIWYG canvas stage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(stageSize.width));
    const h = Math.max(1, Math.round(stageSize.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Subtle studio checker background
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 0, w, h);
    const tile = 16;
    ctx.fillStyle = '#E2E8F0';
    for (let y = 0; y < h; y += tile) {
      for (let x = ((y / tile) % 2) * tile; x < w; x += tile * 2) {
        ctx.fillRect(x, y, tile, tile);
      }
    }

    if (loadedImage) {
      const { drawScale, tx, ty } = getTransformGeometry(loadedImage, w, h);
      ctx.save();
      ctx.translate(w / 2 + tx, h / 2 + ty);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(drawScale, drawScale);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        loadedImage,
        -loadedImage.naturalWidth / 2,
        -loadedImage.naturalHeight / 2
      );
      ctx.restore();
    }

    ctx.restore();
  }, [loadedImage, stageSize, isOpen, rotation, getTransformGeometry]);

  // Handle Escape key to close cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSaving, onClose]);

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Format file harus berupa gambar (JPG, PNG, atau WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImageError('Ukuran file maksimal 15 MB agar proses crop tetap cepat.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourceUrl(reader.result);
        setZoom(1.1);
        setOffsetX(0);
        setOffsetY(0);
        setRotation(0);
        setImageError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAspectSelect = (nextAspect: AspectRatioOption) => {
    setAspectRatio(nextAspect);
    if (nextAspect !== 'free') {
      setCropBox(getPresetCropBox(nextAspect, stageSize.width, stageSize.height));
    }
  };

  const startPointerDrag = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
      startBox: { ...cropBox },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.mode) return;
    const dxPx = e.clientX - drag.startClientX;
    const dyPx = e.clientY - drag.startClientY;

    if (drag.mode === 'pan') {
      const nextX = clamp(
        drag.startOffsetX + (dxPx / (stageSize.width * 0.5)) * 100,
        -100,
        100
      );
      const nextY = clamp(
        drag.startOffsetY + (dyPx / (stageSize.height * 0.5)) * 100,
        -100,
        100
      );
      setOffsetX(Math.round(nextX * 10) / 10);
      setOffsetY(Math.round(nextY * 10) / 10);
      return;
    }

    const dxNorm = dxPx / stageSize.width;
    const dyNorm = dyPx / stageSize.height;
    const sb = drag.startBox;
    const minSize = 0.16;

    if (drag.mode === 'move-box') {
      setCropBox({
        x: clamp(sb.x + dxNorm, 0, 1 - sb.width),
        y: clamp(sb.y + dyNorm, 0, 1 - sb.height),
        width: sb.width,
        height: sb.height,
      });
      return;
    }

    // Resizing handles — switches to 'free' if dragging edges or preserves ratio if preset locked
    const activePreset = ASPECT_PRESETS.find((p) => p.id === aspectRatio);
    const lockedRatio = activePreset?.ratio ?? null;

    let left = sb.x;
    let top = sb.y;
    let right = sb.x + sb.width;
    let bottom = sb.y + sb.height;

    if (drag.mode.includes('w')) left = clamp(sb.x + dxNorm, 0, right - minSize);
    if (drag.mode.includes('e')) right = clamp(sb.x + sb.width + dxNorm, left + minSize, 1);
    if (drag.mode.includes('n')) top = clamp(sb.y + dyNorm, 0, bottom - minSize);
    if (drag.mode.includes('s')) bottom = clamp(sb.y + sb.height + dyNorm, top + minSize, 1);

    let nextW = right - left;
    let nextH = bottom - top;

    if (
      lockedRatio !== null &&
      (drag.mode === 'resize-nw' ||
        drag.mode === 'resize-ne' ||
        drag.mode === 'resize-sw' ||
        drag.mode === 'resize-se')
    ) {
      // Maintain exact aspect ratio in pixels
      const desiredH = (nextW * stageSize.width) / lockedRatio / stageSize.height;
      if (desiredH >= minSize && top + desiredH <= 1) {
        if (drag.mode.includes('n')) {
          top = clamp(bottom - desiredH, 0, bottom - minSize);
          nextH = bottom - top;
        } else {
          nextH = desiredH;
        }
      } else {
        const clampedH = Math.min(nextH, 1 - top);
        const adjustedW = (clampedH * stageSize.height * lockedRatio) / stageSize.width;
        nextH = clampedH;
        nextW = clamp(adjustedW, minSize, 1 - left);
      }
    } else if (
      lockedRatio !== null &&
      (drag.mode === 'resize-n' ||
        drag.mode === 'resize-s' ||
        drag.mode === 'resize-w' ||
        drag.mode === 'resize-e')
    ) {
      setAspectRatio('free');
    }

    setCropBox({
      x: clamp(left, 0, 1 - minSize),
      y: clamp(top, 0, 1 - minSize),
      width: clamp(nextW, minSize, 1 - left),
      height: clamp(nextH, minSize, 1 - top),
    });
  };

  const endPointerDrag = () => {
    dragRef.current.mode = null;
  };

  const handleStageWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) =>
      Math.round(clamp(prev + delta, VALIDATION_LIMITS.MIN_ZOOM, VALIDATION_LIMITS.MAX_ZOOM) * 100) / 100
    );
  };

  const nudgeOffset = (dx: number, dy: number) => {
    setOffsetX((prev) => Math.round(clamp(prev + dx, -100, 100) * 10) / 10);
    setOffsetY((prev) => Math.round(clamp(prev + dy, -100, 100) * 10) / 10);
  };

  const exportCroppedDataUrl = (): string => {
    if (!loadedImage) {
      throw new Error('Silakan unggah foto terlebih dahulu sebelum menyimpan.');
    }

    const stageW = stageSize.width;
    const stageH = stageSize.height;
    const rx = cropBox.x * stageW;
    const ry = cropBox.y * stageH;
    const rw = Math.max(10, cropBox.width * stageW);
    const rh = Math.max(10, cropBox.height * stageH);

    const maxExportDim = 920;
    const scaleFactor = Math.min(maxExportDim / rw, maxExportDim / rh);
    const outW = Math.max(120, Math.round(rw * scaleFactor));
    const outH = Math.max(120, Math.round(rh * scaleFactor));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung kanvas pemotongan foto.');

    const { drawScale, tx, ty } = getTransformGeometry(loadedImage, stageW, stageH);

    // Pure white clean studio background so zoomed-out transparent margins stay crisp
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);

    ctx.save();
    ctx.scale(outW / rw, outH / rh);
    ctx.translate(-rx, -ry);
    ctx.translate(stageW / 2 + tx, stageH / 2 + ty);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(drawScale, drawScale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      loadedImage,
      -loadedImage.naturalWidth / 2,
      -loadedImage.naturalHeight / 2
    );
    ctx.restore();

    // Iteratively fit cleanly beneath Firestore 350,000-byte security rule cap
    const qualities = [0.86, 0.78, 0.68, 0.56];
    let result = outCanvas.toDataURL('image/jpeg', 0.86);
    for (const q of qualities) {
      result = outCanvas.toDataURL('image/jpeg', q);
      if (result.length <= 320000) {
        return result;
      }
    }

    // Fallback smaller resolution if extremely noisy photograph
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = Math.round(outW * 0.72);
    fallbackCanvas.height = Math.round(outH * 0.72);
    const fCtx = fallbackCanvas.getContext('2d');
    if (fCtx) {
      fCtx.drawImage(outCanvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
      result = fallbackCanvas.toDataURL('image/jpeg', 0.72);
    }
    return result;
  };

  const handleSaveClick = async () => {
    setSaveError('');
    if (!loadedImage) {
      setSaveError('Silakan pilih atau unggah foto terlebih dahulu.');
      return;
    }
    setIsSaving(true);
    try {
      const croppedDataUrl = exportCroppedDataUrl();
      const nextConfig: MediaSlotConfig = {
        slotId,
        imageDataUrl: croppedDataUrl,
        originalDataUrl: sourceUrl,
        zoom: Math.round(zoom * 100) / 100,
        offsetX: Math.round(offsetX * 10) / 10,
        offsetY: Math.round(offsetY * 10) / 10,
        rotation,
        aspectRatio,
        cropBox,
        updatedAt: new Date(),
        source: isAdmin ? 'cloud' : 'local',
      };
      await onSave(nextConfig, isAdmin);
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Gagal menyimpan hasil crop foto.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetClick = async () => {
    setIsResetting(true);
    setSaveError('');
    try {
      await onResetToDefault(slotId);
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Gagal mengembalikan foto bawaan.'
      );
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  const cropPxW = Math.round(cropBox.width * stageSize.width);
  const cropPxH = Math.round(cropBox.height * stageSize.height);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B2535]/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-editor-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h2
              id="photo-editor-title"
              className="text-base sm:text-lg font-bold text-[#0B2535] truncate"
            >
              Editor Foto Presisi — {slotTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah foto bebas, geser atas/bawah/kiri/kanan, perbesar, dan sesuaikan area crop secara presisi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup editor foto"
            className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:text-[#0B2535] hover:bg-slate-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Studio Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Left Stage: Interactive Precision Canvas & Resizable Crop Overlay */}
          <div className="lg:col-span-7 p-4 sm:p-6 bg-[#F7FAFC] border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between gap-4">
            <div
              ref={stageRef}
              onWheel={handleStageWheel}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                const dropped = e.dataTransfer.files?.[0] ?? null;
                handleFileSelected(dropped);
              }}
              className={`relative w-full h-[320px] sm:h-[420px] rounded-lg overflow-hidden border select-none touch-none ${
                isDraggingFile
                  ? 'border-[#146C43] ring-2 ring-[#146C43]/30'
                  : 'border-slate-300'
              }`}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full block"
              />

              {/* Empty Drop Prompt when no image loaded yet */}
              {!loadedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white/90">
                  <div className="w-12 h-12 rounded-lg bg-[#146C43]/10 text-[#146C43] flex items-center justify-center mb-3">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-[#0B2535] mb-1">
                    Belum ada foto dipilih untuk {slotTitle}
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs mb-4">
                    Tarik & lepas file gambar ke area ini atau klik tombol di bawah untuk mengunggah foto (JPG, PNG, WebP).
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#146C43] text-white text-xs font-medium hover:bg-[#0F5434] transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Pilih Foto dari Perangkat
                  </button>
                </div>
              )}

              {/* Interactive Darkened Crop Mask + Draggable Handles */}
              {loadedImage && (
                <div
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => startPointerDrag('pan', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endPointerDrag}
                  onPointerCancel={endPointerDrag}
                >
                  {/* Dimmed Outside Mask (4 clean strips around crop frame) */}
                  <div
                    className="absolute left-0 right-0 top-0 bg-[#0B2535]/55 pointer-events-none"
                    style={{ height: `${cropBox.y * 100}%` }}
                  />
                  <div
                    className="absolute left-0 right-0 bottom-0 bg-[#0B2535]/55 pointer-events-none"
                    style={{ height: `${Math.max(0, (1 - cropBox.y - cropBox.height) * 100)}%` }}
                  />
                  <div
                    className="absolute left-0 bg-[#0B2535]/55 pointer-events-none"
                    style={{
                      top: `${cropBox.y * 100}%`,
                      height: `${cropBox.height * 100}%`,
                      width: `${cropBox.x * 100}%`,
                    }}
                  />
                  <div
                    className="absolute right-0 bg-[#0B2535]/55 pointer-events-none"
                    style={{
                      top: `${cropBox.y * 100}%`,
                      height: `${cropBox.height * 100}%`,
                      width: `${Math.max(0, (1 - cropBox.x - cropBox.width) * 100)}%`,
                    }}
                  />

                  {/* Active Precision Crop Frame */}
                  <div
                    className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(11,37,53,0.45)]"
                    style={{
                      left: `${cropBox.x * 100}%`,
                      top: `${cropBox.y * 100}%`,
                      width: `${cropBox.width * 100}%`,
                      height: `${cropBox.height * 100}%`,
                    }}
                  >
                    {/* Rule of thirds precision grid */}
                    {showGrid && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/45" />
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/45" />
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/45" />
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/45" />
                      </div>
                    )}

                    {/* Move Crop Box Handle (small center-top tab) */}
                    <button
                      type="button"
                      title="Geser posisi kotak crop"
                      onPointerDown={(e) => startPointerDrag('move-box', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={endPointerDrag}
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#0B2535] text-white text-[10px] font-medium whitespace-nowrap cursor-move flex items-center gap-1 shadow"
                    >
                      <Crop className="w-2.5 h-2.5" />
                      Geser Bingkai
                    </button>

                    {/* 4 Corner Handles */}
                    {(
                      [
                        { mode: 'resize-nw', cls: '-top-2 -left-2 cursor-nwse-resize' },
                        { mode: 'resize-ne', cls: '-top-2 -right-2 cursor-nesw-resize' },
                        { mode: 'resize-sw', cls: '-bottom-2 -left-2 cursor-nesw-resize' },
                        { mode: 'resize-se', cls: '-bottom-2 -right-2 cursor-nwse-resize' },
                      ] as const
                    ).map((h) => (
                      <div
                        key={h.mode}
                        onPointerDown={(e) => startPointerDrag(h.mode, e)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endPointerDrag}
                        onPointerCancel={endPointerDrag}
                        className={`absolute w-4 h-4 bg-white border-2 border-[#146C43] rounded-sm shadow ${h.cls}`}
                      />
                    ))}

                    {/* 4 Edge Handles (Free crop precision adjustment) */}
                    <div
                      onPointerDown={(e) => startPointerDrag('resize-n', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={endPointerDrag}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-white border border-[#146C43] rounded-xs cursor-ns-resize shadow"
                    />
                    <div
                      onPointerDown={(e) => startPointerDrag('resize-s', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={endPointerDrag}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-white border border-[#146C43] rounded-xs cursor-ns-resize shadow"
                    />
                    <div
                      onPointerDown={(e) => startPointerDrag('resize-w', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={endPointerDrag}
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-8 w-2.5 bg-white border border-[#146C43] rounded-xs cursor-ew-resize shadow"
                    />
                    <div
                      onPointerDown={(e) => startPointerDrag('resize-e', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={endPointerDrag}
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-8 w-2.5 bg-white border border-[#146C43] rounded-xs cursor-ew-resize shadow"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Live Precision Telemetry Readout */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <div className="font-mono tabular-nums flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span>Zoom {Math.round(zoom * 100)}%</span>
                <span aria-hidden="true">·</span>
                <span>X {offsetX > 0 ? `+${offsetX}` : offsetX}%</span>
                <span aria-hidden="true">·</span>
                <span>Y {offsetY > 0 ? `+${offsetY}` : offsetY}%</span>
                <span aria-hidden="true">·</span>
                <span>
                  Area {cropPxW}×{cropPxH}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGrid((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    showGrid
                      ? 'bg-[#0B2535] text-white border-[#0B2535]'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-[#0B2535]'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Grid Presisi
                </button>
              </div>
            </div>
          </div>

          {/* Right Precision Control Panel */}
          <div className="lg:col-span-5 p-4 sm:p-6 space-y-5 bg-white">
            {/* 1. Upload Photo */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-[#0B2535]">
                  1. Unggah Sumber Foto
                </span>
                {currentConfig && (
                  <button
                    type="button"
                    onClick={handleResetClick}
                    disabled={isResetting || isSaving}
                    className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isResetting ? 'Menghapus...' : 'Foto Bawaan'}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-300 bg-[#F7FAFC] hover:border-[#146C43] hover:bg-[#146C43]/5 text-xs font-medium text-[#0B2535] transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#146C43]" />
                {loadedImage ? 'Ganti / Unggah Foto Baru (JPG, PNG, WebP)' : 'Unggah Foto dari Perangkat'}
              </button>
              {imageError && (
                <p className="text-xs text-red-700 mt-1.5" role="alert">
                  {imageError}
                </p>
              )}
            </div>

            {/* 2. Aspect Ratio & Crop Dimensions */}
            <div className="pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-[#0B2535]">
                  2. Rasio & Potong (Crop)
                </span>
                <span className="text-[11px] text-slate-500">
                  Tarik sudut/sisi bingkai atau pilih rasio
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1 p-1 bg-slate-100 rounded-lg">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAspectSelect(preset.id)}
                    className={`py-1.5 px-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      aspectRatio === preset.id
                        ? 'bg-white text-[#0B2535] shadow-xs'
                        : 'text-slate-600 hover:text-[#0B2535]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Direct precision width/height crop sliders when in Bebas mode */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <label className="block">
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Lebar Crop</span>
                    <span className="font-mono tabular-nums">
                      {Math.round(cropBox.width * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={98}
                    value={Math.round(cropBox.width * 100)}
                    onChange={(e) => {
                      const nextW = Number(e.target.value) / 100;
                      setAspectRatio('free');
                      setCropBox((prev) => ({
                        ...prev,
                        width: nextW,
                        x: clamp(prev.x, 0, 1 - nextW),
                      }));
                    }}
                    className="w-full accent-[#146C43]"
                  />
                </label>
                <label className="block">
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Tinggi Crop</span>
                    <span className="font-mono tabular-nums">
                      {Math.round(cropBox.height * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={98}
                    value={Math.round(cropBox.height * 100)}
                    onChange={(e) => {
                      const nextH = Number(e.target.value) / 100;
                      setAspectRatio('free');
                      setCropBox((prev) => ({
                        ...prev,
                        height: nextH,
                        y: clamp(prev.y, 0, 1 - nextH),
                      }));
                    }}
                    className="w-full accent-[#146C43]"
                  />
                </label>
              </div>
            </div>

            {/* 3. Zoom Controls */}
            <div className="pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#0B2535]">
                  3. Perbesar / Perkecil (Zoom)
                </span>
                <span className="font-mono text-xs text-[#146C43] font-semibold tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Perkecil foto"
                  onClick={() =>
                    setZoom((z) =>
                      Math.round(clamp(z - 0.1, VALIDATION_LIMITS.MIN_ZOOM, VALIDATION_LIMITS.MAX_ZOOM) * 100) / 100
                    )
                  }
                  className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  aria-label="Skala perbesaran foto"
                  min={50}
                  max={300}
                  step={1}
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  className="flex-1 accent-[#146C43]"
                />
                <button
                  type="button"
                  aria-label="Perbesar foto"
                  onClick={() =>
                    setZoom((z) =>
                      Math.round(clamp(z + 0.1, VALIDATION_LIMITS.MIN_ZOOM, VALIDATION_LIMITS.MAX_ZOOM) * 100) / 100
                    )
                  }
                  className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4. Precision Directional Panning (Atas, Bawah, Kiri, Kanan) */}
            <div className="pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-[#0B2535]">
                  4. Posisi Presisi (Atas · Bawah · Kiri · Kanan)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setOffsetX(0);
                    setOffsetY(0);
                    setRotation(0);
                  }}
                  className="text-xs text-[#0284C7] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Reset Posisi
                </button>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Tactile D-pad */}
                <div className="col-span-5 grid grid-cols-3 gap-1 max-w-[126px]">
                  <div />
                  <button
                    type="button"
                    aria-label="Geser foto ke atas"
                    onClick={() => nudgeOffset(0, -4)}
                    className="h-9 rounded-md border border-slate-200 bg-[#F7FAFC] hover:bg-slate-100 flex items-center justify-center text-[#0B2535] cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <div />
                  <button
                    type="button"
                    aria-label="Geser foto ke kiri"
                    onClick={() => nudgeOffset(-4, 0)}
                    className="h-9 rounded-md border border-slate-200 bg-[#F7FAFC] hover:bg-slate-100 flex items-center justify-center text-[#0B2535] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Pusatkan foto"
                    aria-label="Pusatkan posisi foto"
                    onClick={() => {
                      setOffsetX(0);
                      setOffsetY(0);
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Geser foto ke kanan"
                    onClick={() => nudgeOffset(4, 0)}
                    className="h-9 rounded-md border border-slate-200 bg-[#F7FAFC] hover:bg-slate-100 flex items-center justify-center text-[#0B2535] cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div />
                  <button
                    type="button"
                    aria-label="Geser foto ke bawah"
                    onClick={() => nudgeOffset(0, 4)}
                    className="h-9 rounded-md border border-slate-200 bg-[#F7FAFC] hover:bg-slate-100 flex items-center justify-center text-[#0B2535] cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <div />
                </div>

                {/* Fine-tune X / Y sliders + Rotate */}
                <div className="col-span-7 space-y-2.5">
                  <label className="block">
                    <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                      <span>Kiri / Kanan</span>
                      <span className="font-mono tabular-nums">{offsetX}%</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value))}
                      className="w-full accent-[#146C43]"
                    />
                  </label>
                  <label className="block">
                    <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                      <span>Atas / Bawah</span>
                      <span className="font-mono tabular-nums">{offsetY}%</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value))}
                      className="w-full accent-[#146C43]"
                    />
                  </label>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setRotation((r) => (((r + 270) % 360) as 0 | 90 | 180 | 270))
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Putar -90°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Putar +90°
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud sync hint for Admin */}
            <div className="pt-3 border-t border-slate-200/80 text-xs text-slate-500 leading-relaxed">
              {isAdmin ? (
                <p className="text-[#146C43] font-medium">
                  Mode Admin aktif — perubahan foto akan langsung tersimpan & tampil bagi seluruh pengunjung GiziSync.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Foto tersimpan otomatis di perangkat ini. Masuk akun Admin Google untuk mempublikasikan ke semua pengunjung.
                  </span>
                  <button
                    type="button"
                    onClick={() => void onAdminSignIn()}
                    className="text-[#0284C7] font-medium hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Masuk Admin Google
                  </button>
                </div>
              )}
            </div>

            {saveError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                {saveError}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving || !loadedImage}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#146C43] text-white text-sm font-medium hover:bg-[#0F5434] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {isAdmin ? 'Simpan & Publikasikan Foto' : 'Simpan & Terapkan Foto'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
