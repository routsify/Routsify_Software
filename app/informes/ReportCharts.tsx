import type { ReactNode } from "react";
import { destinations, funnelSteps, money, percent, teamRows, timeSeries, timingMetrics } from "@/lib/report-decision";

const colors = ["#0c7a43", "#39a86b", "#6aa9ff", "#9b7cf4", "#f6b24b", "#e86161", "#91a5b1"];

export function ReportCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card report-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="panel-head"><h2>{title}</h2>{action}</div>
      <div style={{ padding: "0 18px 18px" }}>{children}</div>
    </section>
  );
}

export function ValueLineChart({ data = timeSeries() }: { data?: ReturnType<typeof timeSeries> }) {
  const max = Math.max(...data.map((item) => item.acceptedValue), 1);
  const points = data.map((item, index) => `${40 + index * 82},${210 - (item.acceptedValue / max) * 170}`).join(" ");
  const area = `40,220 ${points} ${40 + (data.length - 1) * 82},220`;
  return (
    <svg viewBox="0 0 420 250" role="img" aria-label="Evolución del valor aceptado" style={{ width: "100%", minHeight: 250 }}>
      {[0, 1, 2, 3].map((row) => <line key={row} x1="34" x2="390" y1={50 + row * 45} y2={50 + row * 45} stroke="#e8f1f4" />)}
      <polygon points={area} fill="#dff6e9" opacity="0.9" />
      <polyline points={points} fill="none" stroke="#0c7a43" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((item, index) => <g key={item.date}><circle cx={40 + index * 82} cy={210 - (item.acceptedValue / max) * 170} r="5" fill="#0c7a43" /><text x={40 + index * 82} y="238" fontSize="11" textAnchor="middle" fill="#607480">{item.date}</text></g>)}
      <text x="36" y="36" fontSize="18" fontWeight="800" fill="#102f3c">{money(data[data.length - 1].acceptedValue)}</text>
    </svg>
  );
}

export function FunnelVisual({ data = funnelSteps() }: { data?: ReturnType<typeof funnelSteps> }) {
  const max = data[0]?.count || 1;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((step, index) => (
        <a key={step.key} href={step.url} style={{ display: "grid", gridTemplateColumns: "170px 1fr 54px 58px", gap: 10, alignItems: "center" }}>
          <strong style={{ fontSize: 12 }}>{step.label}</strong>
          <span style={{ height: 26, borderRadius: 8, background: "#eef5f6", overflow: "hidden" }}>
            <span style={{ display: "block", width: `${Math.max(8, (step.count / max) * 100)}%`, height: "100%", borderRadius: 8, background: colors[index % colors.length], opacity: 0.72 }} />
          </span>
          <b>{step.count}</b>
          <small>{percent(step.conversionFromLeadPct)}</small>
        </a>
      ))}
    </div>
  );
}

export function DestinationDonut({ data = destinations() }: { data?: ReturnType<typeof destinations> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let current = 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "center" }}>
      <svg viewBox="0 0 180 180" style={{ width: "100%", maxWidth: 220 }}>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef5f6" strokeWidth="28" />
        {data.map((item, index) => {
          const dash = (item.value / total) * circumference;
          const offset = -current;
          current += dash;
          return <circle key={item.destination} cx="90" cy="90" r={radius} fill="none" stroke={colors[index % colors.length]} strokeWidth="28" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={offset} transform="rotate(-90 90 90)" />;
        })}
        <text x="90" y="88" textAnchor="middle" fontSize="18" fontWeight="900" fill="#102f3c">{money(total)}</text>
        <text x="90" y="108" textAnchor="middle" fontSize="11" fill="#6c7f89">Total</text>
      </svg>
      <div className="donut-list">{data.map((item) => <a key={item.destination} href={`/expedientes?destination=${item.destination}`}><strong>{item.destination}</strong><span>{money(item.value)} · {percent(item.sharePct)}</span></a>)}</div>
    </div>
  );
}

export function TimingBars({ data = timingMetrics() }: { data?: ReturnType<typeof timingMetrics> }) {
  const max = Math.max(...data.map((item) => item.averageDays), 1);
  return <div style={{ display: "grid", gap: 12 }}>{data.map((item) => <a key={item.key} href={item.url} style={{ display: "grid", gridTemplateColumns: "220px 1fr 70px", gap: 10, alignItems: "center" }}><span style={{ fontSize: 12 }}>{item.label}</span><span className="progress-track"><span style={{ width: `${(item.averageDays / max) * 100}%` }} /></span><strong>{item.averageDays} días</strong></a>)}</div>;
}

export function FinanceLines({ data = timeSeries() }: { data?: ReturnType<typeof timeSeries> }) {
  const max = Math.max(...data.flatMap((item) => [item.confirmedRevenue, item.estimatedProfit, item.realProfit]), 1);
  const points = (key: "confirmedRevenue" | "estimatedProfit" | "realProfit") => data.map((item, index) => `${36 + index * 82},${210 - (item[key] / max) * 170}`).join(" ");
  return (
    <svg viewBox="0 0 420 250" role="img" aria-label="Ingresos costes beneficio" style={{ width: "100%", minHeight: 250 }}>
      {[0, 1, 2, 3].map((row) => <line key={row} x1="30" x2="390" y1={50 + row * 45} y2={50 + row * 45} stroke="#e8f1f4" />)}
      <polyline points={points("confirmedRevenue")} fill="none" stroke="#0c7a43" strokeWidth="4" strokeLinecap="round" />
      <polyline points={points("estimatedProfit")} fill="none" stroke="#f6b24b" strokeWidth="4" strokeLinecap="round" />
      <polyline points={points("realProfit")} fill="none" stroke="#6aa9ff" strokeWidth="4" strokeLinecap="round" />
      {data.map((item, index) => <text key={item.date} x={36 + index * 82} y="238" fontSize="11" textAnchor="middle" fill="#607480">{item.date}</text>)}
    </svg>
  );
}

export function MiniTimingCards({ data = timingMetrics() }: { data?: ReturnType<typeof timingMetrics> }) {
  return <div className="mini-kpis">{data.map((item) => <a key={item.key} className={`mini-kpi ${item.status}`} href={item.url}><strong>{item.averageDays} días</strong><span>{item.label}</span><small>Objetivo {item.targetDays} · P90 {item.p90Days}</small></a>)}</div>;
}

export function TeamBars({ data = teamRows() }: { data?: ReturnType<typeof teamRows> }) {
  const max = Math.max(...data.map((item) => item.acceptedValue), 1);
  return <div style={{ display: "grid", gap: 12 }}>{data.map((item) => <div key={item.userId} style={{ display: "grid", gridTemplateColumns: "130px 1fr 90px", gap: 10, alignItems: "center" }}><strong>{item.userName}</strong><span className="progress-track"><span style={{ width: `${(item.acceptedValue / max) * 100}%` }} /></span><b>{money(item.acceptedValue)}</b></div>)}</div>;
}
