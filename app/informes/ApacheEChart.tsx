"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsOption } from "echarts";

export function ApacheEChart({ option, height = 280 }: { option: EChartsOption; height?: number }) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    let cancelled = false;
    let removeResize: (() => void) | null = null;

    async function mountChart() {
      const echarts = await import("echarts");
      if (!elementRef.current || cancelled) return;

      chartRef.current = echarts.init(elementRef.current, undefined, { renderer: "canvas" });
      chartRef.current.setOption(option, true);

      const resize = () => chartRef.current?.resize();
      window.addEventListener("resize", resize);
      removeResize = () => window.removeEventListener("resize", resize);
    }

    mountChart();

    return () => {
      cancelled = true;
      removeResize?.();
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.dispose();
      }
      chartRef.current = null;
    };
  }, [option]);

  return <div ref={elementRef} style={{ width: "100%", height, minHeight: height }} aria-label="Gráfico Apache ECharts" />;
}
