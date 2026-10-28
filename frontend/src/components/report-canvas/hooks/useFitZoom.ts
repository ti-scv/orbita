import { useCallback, useRef, useState } from "react";
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
  pageWidth,
}: UseFitZoomParams) {
  const [zoom, setZoom] = useState(0.85);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageWidthRef = useRef(pageWidth);
  pageWidthRef.current = pageWidth;

  const fitToWidth = useCallback((targetPageWidth?: number) => {
    const el = stageRef.current;
    if (!el) return;
    const pw = targetPageWidth ?? pageWidthRef.current;
    const available = Math.max(200, el.clientWidth - 64);
    const computed = clamp(Math.floor((available / pw) * 100) / 100, 0.25, 1.5);
    setZoom(computed);
  }, []);

  return { zoom, setZoom, stageRef, fitToWidth };
}
