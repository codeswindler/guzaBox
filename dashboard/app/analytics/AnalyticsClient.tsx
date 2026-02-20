"use client";

import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

type OverviewBlock = {
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  failedCount: number;
};

type Overview = {
  today: OverviewBlock;
  last7: OverviewBlock;
  allTime: OverviewBlock;
};

type TrendRow = {
  period: string;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  failedCount: number;
};

type LeaderRow = {
  phoneNumber: string;
  payerName: string | null;
  count: number;
  amount: number;
};

export default function AnalyticsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [range, setRange] = useState("daily");
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  const [error, setError] = useState("");
  const envMock = process.env.NEXT_PUBLIC_MOCK_DATA === "true";
  const [mockEnabled, setMockEnabled] = useState(envMock);
  const mockNames = useMemo(
    () => ["James Kariuki", "Amina Ali", "Peter Maina", "Faith Wambui"],
    []
  );

  const buildMockTrends = () => {
    const labels =
      range === "monthly"
        ? ["Sep", "Oct", "Nov", "Dec", "Jan"]
        : range === "weekly"
        ? ["Wk 1", "Wk 2", "Wk 3", "Wk 4"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return labels.map((period) => ({
      period,
      paidCount: Math.floor(40 + Math.random() * 60),
      paidAmount: Math.floor(5000 + Math.random() * 8000),
      pendingCount: Math.floor(5 + Math.random() * 12),
      failedCount: Math.floor(4 + Math.random() * 10),
    }));
  };

  const buildMockLeaders = () =>
    Array.from({ length: 10 }).map((_, idx) => ({
      phoneNumber: `2547${Math.floor(100000 + Math.random() * 899999)}`,
      payerName: mockNames[idx % mockNames.length],
      count: Math.floor(4 + Math.random() * 12),
      amount: Math.floor(4000 + Math.random() * 9000),
    }));

  const applyMock = () => {
    const mockTrends = buildMockTrends();
    const mockLeaders = buildMockLeaders();
    const summaryAmount = mockTrends.reduce(
      (acc, row) => acc + row.paidAmount,
      0
    );
    const summaryCount = mockTrends.reduce(
      (acc, row) => acc + row.paidCount,
      0
    );
    setTrends(mockTrends);
    setLeaders(mockLeaders);
    setOverview({
      today: {
        paidAmount: summaryAmount * 0.2,
        paidCount: Math.floor(summaryCount * 0.2),
        pendingCount: 18,
        failedCount: 6,
      },
      last7: {
        paidAmount: summaryAmount,
        paidCount: summaryCount,
        pendingCount: 120,
        failedCount: 40,
      },
      allTime: {
        paidAmount: summaryAmount * 6,
        paidCount: summaryCount * 6,
        pendingCount: 900,
        failedCount: 260,
      },
    });
  };

  const load = async () => {
    if (mockEnabled) {
      applyMock();
      return;
    }
    try {
      setError("");
      const [overviewRes, trendsRes, leaderRes] = await Promise.all([
        api.get("/analytics/overview"),
        api.get("/analytics/trends", { params: { range } }),
        api.get("/payments/leaderboard", { params: { range } }),
      ]);
      setOverview(overviewRes.data);
      setTrends(trendsRes.data);
      setLeaders(leaderRes.data);
    } catch (error: any) {
      if (envMock) {
        setMockEnabled(true);
        applyMock();
      } else {
        setError("Live analytics unavailable. Ensure API access and seed data.");
      }
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [range]);

  useEffect(() => {
    if (!mockEnabled) return;
    const timer = setInterval(() => {
      applyMock();
      setToasts((prev) => [
        `Potential winners updated · ${new Date().toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })}`,
        `Incoming payment Ksh ${Math.floor(50 + Math.random() * 250)}`,
        ...prev,
      ]);
    }, 12000);
    return () => clearInterval(timer);
  }, [mockEnabled, range]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPeriod = (period: string) => {
    if (range !== "daily") return period;
    const date = new Date(period);
    if (Number.isNaN(date.getTime())) return period;
    const day = date.toLocaleDateString("en-US", { 
      timeZone: "Africa/Nairobi",
      weekday: "short" 
    });
    const dateLabel = date.toLocaleDateString("en-US", {
      timeZone: "Africa/Nairobi",
      month: "short",
      day: "numeric",
    });
    return `${day} · ${dateLabel}`;
  };

  const topLeaders = useMemo(
    () => [...leaders].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [leaders]
  );

  return (
    <div>
      <h2 className="page-title">Analytics</h2>
      <p className="subtle">
        Track collections and top payers.
        {mockEnabled && " (mock data)"}
      </p>
      {error && <p className="subtle">{error}</p>}
      <div className="stat-grid">
        {overview ? (
          <>
            <div className="card demo-card kpi-tile">
              <p className="kpi-label">Today Collected</p>
              <p className="kpi-value">
                {formatMoney(overview.today.paidAmount)}
              </p>
              <p className="subtle">
                {overview.today.paidCount} paid · {overview.today.pendingCount} pending ·{" "}
                {overview.today.failedCount} failed
              </p>
            </div>
            <div className="card demo-card kpi-tile">
              <p className="kpi-label">Last 7 Days</p>
              <p className="kpi-value">
                {formatMoney(overview.last7.paidAmount)}
              </p>
              <p className="subtle">
                {overview.last7.paidCount} paid · {overview.last7.pendingCount} pending ·{" "}
                {overview.last7.failedCount} failed
              </p>
            </div>
            <div className="card demo-card kpi-tile">
              <p className="kpi-label">All Time</p>
              <p className="kpi-value">
                {formatMoney(overview.allTime.paidAmount)}
              </p>
              <p className="subtle">
                {overview.allTime.paidCount} paid · {overview.allTime.pendingCount} pending ·{" "}
                {overview.allTime.failedCount} failed
              </p>
            </div>
          </>
        ) : (
          <div className="card">Loading analytics...</div>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Transaction Trends</h3>
            <p className="subtle">Paid, pending, and failed volume.</p>
          </div>
          <div className="range-control">
            <label>Range</label>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="trend-list">
          {trends.map((row) => {
            const total =
              row.paidCount + row.pendingCount + row.failedCount || 1;
            const paidWidth = (row.paidCount / total) * 100;
            const pendingWidth = (row.pendingCount / total) * 100;
            const failedWidth = (row.failedCount / total) * 100;
            return (
              <div key={row.period} className="trend-row">
                <div className="trend-label">{formatPeriod(row.period)}</div>
                <div className="trend-bar">
                  <span style={{ width: `${paidWidth}%` }} className="trend-paid" />
                  <span
                    style={{ width: `${pendingWidth}%` }}
                    className="trend-pending"
                  />
                  <span
                    style={{ width: `${failedWidth}%` }}
                    className="trend-failed"
                  />
                </div>
                <div className="trend-meta">
                  <span>{formatMoney(row.paidAmount)} collected</span>
                  <span>{row.paidCount} paid</span>
                  <span>{row.pendingCount} pending</span>
                  <span>{row.failedCount} failed</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Potential Winners</h3>
            <p className="subtle">
              Top 10 players by total amount paid for the selected range.
            </p>
          </div>
          <span className="filter-badge">{range} filter</span>
        </div>
        <div className="winner-grid">
          {topLeaders.map((row) => (
            <div key={row.phoneNumber} className="demo-card winner-card">
              <div className="winner-header">
                <span className="winner-name">{row.payerName || "Unknown"}</span>
                <span className="winner-count">{row.count} payments</span>
              </div>
              <div className="mono winner-contact">{row.phoneNumber}</div>
              <div className="winner-amount">{formatMoney(row.amount)}</div>
              <div className="subtle">Highest total paid</div>
            </div>
          ))}
        </div>
      </div>
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.slice(0, 4).map((toast, idx) => (
            <div key={idx} className="toast">
              {toast}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
