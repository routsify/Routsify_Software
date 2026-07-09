"use client";

import type { ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { destinations, funnelSteps, money, percent, teamRows, timeSeries, timingMetrics } from "@/lib/report-decision";
import { ApacheEChart } from "./ApacheEChart";

const palette = ["#0c7a43", "#39a86b", "#6aa9ff", "#9b7cf4", "#f6b24b", "#e86161", "#91a5b1"];

const baseGrid = { left: 42, right: 18, top: 28, bottom: 34 };

export function ReportCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card report-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="panel-head"><h2>{title}</h2>{action}</div>
      <div style={{ padding: "0 18px 18px" }}>{children}</div>
    </section>
  );
}

export function ValueLineChart({ data = timeSeries() }: { data?: ReturnType<typeof timeSeries> }) {
  const option: EChartsOption = {
    color: [palette[0]],
    tooltip: { trigger: "axis" },
    grid: baseGrid,
    xAxis: { type: "category", boundaryGap: false, data: data.map((item) => item.date) },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "#e8f1f4" } } },
    series: [{ name: "Valor aceptado", type: "line", smooth: true, symbolSize: 8, lineStyle: { width: 4 }, areaStyle: { opacity: 0.22 }, data: data.map((item) => item.acceptedValue) }],
  };
  return <ApacheEChart option={option} height={286} />;
}

export function FunnelVisual({ data = funnelSteps() }: { data?: ReturnType<typeof funnelSteps> }) {
  const option: EChartsOption = {
    color: palette,
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    series: [{ name: "Embudo", type: "funnel", left: "8%", top: 10, bottom: 10, width: "84%", sort: "none", gap: 3, label: { position: "inside", formatter: "{b}\n{c}" }, data: data.map((step) => ({ name: step.label, value: step.count })) }],
  };
  return <ApacheEChart option={option} height={286} />;
}

export function DestinationDonut({ data = destinations() }: { data?: ReturnType<typeof destinations> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const option: EChartsOption = {
    color: palette,
    tooltip: { trigger: "item" },
    legend: { orient: "vertical", right: 0, top: "center" },
    series: [{ name: "Valor aceptado", type: "pie", radius: ["48%", "74%"], center: ["34%", "50%"], avoidLabelOverlap: true, label: { formatter: "{b}" }, data: data.map((item) => ({ name: item.destination, value: item.value })) }],
  };
  return (
    <div style={{ position: "relative" }}>
      <ApacheEChart option={option} height={286} />
      <div aria-hidden="true" style={{ position: "absolute", left: "34%", top: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: "#102f3c", fontWeight: 800, pointerEvents: "none", lineHeight: 1.25 }}>
        <div>{money(total)}</div>
        <small style={{ color: "#6c7f89", fontWeight: 600 }}>Total</small>
      </div>
    </div>
  );
}

export function TimingBars({ data = timingMetrics() }: { data?: ReturnType<typeof timingMetrics> }) {
  const option: EChartsOption = {
    color: [palette[2]],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 165, right: 18, top: 12, bottom: 20 },
    xAxis: { type: "value", splitLine: { lineStyle: { color: "#e8f1f4" } } },
    yAxis: { type: "category", data: data.map((item) => item.label), axisLabel: { width: 150, overflow: "truncate" } },
    series: [{ name: "Días promedio", type: "bar", barWidth: 12, itemStyle: { borderRadius: [0, 8, 8, 0] }, data: data.map((item) => item.averageDays) }],
  };
  return <ApacheEChart option={option} height={286} />;
}

export function FinanceLines({ data = timeSeries() }: { data?: ReturnType<typeof timeSeries> }) {
  const option: EChartsOption = {
    color: [palette[0], palette[4], palette[2]],
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    grid: { left: 42, right: 18, top: 48, bottom: 34 },
    xAxis: { type: "category", boundaryGap: false, data: data.map((item) => item.date) },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "#e8f1f4" } } },
    series: [
      { name: "Ingresos", type: "line", smooth: true, lineStyle: { width: 3 }, data: data.map((item) => item.confirmedRevenue) },
      { name: "Beneficio previsto", type: "line", smooth: true, lineStyle: { width: 3 }, data: data.map((item) => item.estimatedProfit) },
      { name: "Beneficio real", type: "line", smooth: true, lineStyle: { width: 3 }, data: data.map((item) => item.realProfit) },
    ],
  };
  return <ApacheEChart option={option} height={286} />;
}

export function MiniTimingCards({ data = timingMetrics() }: { data?: ReturnType<typeof timingMetrics> }) {
  const option: EChartsOption = {
    color: [palette[3], palette[0], palette[4], palette[2]],
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    grid: { left: 36, right: 18, top: 48, bottom: 34 },
    xAxis: { type: "category", data: ["1 May", "8 May", "15 May", "22 May", "31 May"] },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#e8f1f4" } } },
    series: data.slice(0, 4).map((item) => ({ name: item.label, type: "line", smooth: true, data: [item.averageDays + 1, item.averageDays + 0.2, item.averageDays + 0.8, item.averageDays - 0.3, item.averageDays] })),
  };
  return <ApacheEChart option={option} height={286} />;
}

export function TeamBars({ data = teamRows() }: { data?: ReturnType<typeof teamRows> }) {
  const option: EChartsOption = {
    color: [palette[0]],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 110, right: 20, top: 16, bottom: 24 },
    xAxis: { type: "value", axisLabel: { formatter: (value: number) => `${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: "#e8f1f4" } } },
    yAxis: { type: "category", data: data.map((item) => item.userName) },
    series: [{ name: "Valor aceptado", type: "bar", barWidth: 18, itemStyle: { borderRadius: [0, 8, 8, 0] }, data: data.map((item) => item.acceptedValue) }],
  };
  return <ApacheEChart option={option} height={286} />;
}
