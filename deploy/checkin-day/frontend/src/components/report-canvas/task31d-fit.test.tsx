// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFitZoom } from "./hooks/useFitZoom";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
it("encaixa a página após carregar e mantém o zoom manual ao redimensionar", () => {
  let resize = () => {};
  vi.stubGlobal("ResizeObserver", class {constructor(callback: () => void) {resize=callback;} observe() {} disconnect() {}});
  let width=600;
  const stage=document.createElement("div");
  Object.defineProperty(stage,"clientWidth",{get:()=>width});
  const hook=renderHook(({loading})=>useFitZoom({loading,pageWidth:1123,leftOpen:true,rightOpen:true,leftWidth:240,rightWidth:256}),{initialProps:{loading:true}});
  hook.result.current.stageRef.current=stage;
  hook.rerender({loading:false});
  expect(hook.result.current.zoom * 1123).toBeLessThanOrEqual(width - 64);
  act(()=>hook.result.current.setZoom(.75));
  width=800;
  act(()=>resize());
  expect(hook.result.current.zoom).toBe(.75);
  act(()=>hook.result.current.fitToWidth());
  expect(hook.result.current.zoom * 1123).toBeLessThanOrEqual(width - 64);
});
