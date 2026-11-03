import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../model";

export interface UseFitZoomParams {
  loading: boolean;
  pageWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
}

export function useFitZoom({
  pageWidth, loading, leftOpen, rightOpen, leftWidth, rightWidth,
}: UseFitZoomParams) {
  const [zoom, setZoomValue] = useState(0.85);
  const autoFit = useRef(true);
  const setZoom = useCallback((value: number | ((previous: number) => number)) => {
    autoFit.current = false;
    setZoomValue(value);
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageWidthRef = useRef(pageWidth);
  pageWidthRef.current = pageWidth;

  const fitToWidth = useCallback((targetPageWidth?: number) => {
    const el = stageRef.current;
    if (!el) return;
    const pw = targetPageWidth ?? pageWidthRef.current;
    const available = Math.max(200, el.clientWidth - 64);
    const computed = clamp(Math.floor((available / pw) * 100) / 100, 0.25, 1.5);
    autoFit.current = true;
    setZoomValue(computed);
  }, []);

  useEffect(() => {
    if (loading || !stageRef.current) return;
    if (autoFit.current) fitToWidth();
    const observer = new ResizeObserver(() => { if (autoFit.current) fitToWidth(); });
    observer.observe(stageRef.current);
    return () => observer.disconnect?.();
  }, [loading, pageWidth, leftOpen, rightOpen, leftWidth, rightWidth, fitToWidth]);

  return { zoom, setZoom, stageRef, fitToWidth };
}
