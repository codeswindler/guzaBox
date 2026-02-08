"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

type Transaction = {
  id: string;
  phoneNumber: string;
  payerName?: string | null;
  amount: number;
  box: string | null;
  status: string;
  createdAt: string;
};

type KpiBlock = { count: number; amount: number };

type Kpis = {
  today: KpiBlock;
  yesterday: KpiBlock;
  last7: KpiBlock;
  prev7: KpiBlock;
  last30: KpiBlock;
  prev30: KpiBlock;
  allTime: KpiBlock;
};

export default function TransactionsClient() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toasts, setToasts] = useState<string[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [kpiRange, setKpiRange] = useState<"today" | "last7" | "allTime">(
    "today"
  );
  const lastSeenRef = useRef<string | null>(null);
  const envMock = process.env.NEXT_PUBLIC_MOCK_DATA === "true";
  const [mockEnabled, setMockEnabled] = useState(envMock);
  const [error, setError] = useState("");

  const buildMockTx = (): Transaction => {
    const amount = Math.floor(20 + Math.random() * 15);
    const phoneSuffix = Math.floor(100000 + Math.random() * 899999);
    const box = `Box ${Math.floor(1 + Math.random() * 6)}`;
    return {
      id: `mock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      phoneNumber: `2547${phoneSuffix}`,
      payerName: ["James Kariuki", "Amina Ali", "Peter Maina"][
        Math.floor(Math.random() * 3)
      ],
      amount,
      box,
      status: "PAID",
      createdAt: new Date().toISOString(),
    };
  };

  const buildMockKpis = (): Kpis => {
    const base = Math.floor(4000 + Math.random() * 4000);
    const today = { count: Math.floor(20 + Math.random() * 30), amount: base };
    const yesterday = {
      count: Math.floor(15 + Math.random() * 20),
      amount: Math.floor(base * 0.8),
    };
    const last7 = {
      count: today.count * 7,
      amount: Math.floor(base * 7.2),
    };
    const prev7 = {
      count: yesterday.count * 7,
      amount: Math.floor(base * 6.5),
    };
    const last30 = {
      count: today.count * 30,
      amount: Math.floor(base * 30.5),
    };
    const prev30 = {
      count: yesterday.count * 30,
      amount: Math.floor(base * 28.8),
    };
    const allTime = {
      count: last30.count + 1200,
      amount: last30.amount + 240000,
    };
    return { today, yesterday, last7, prev7, last30, prev30, allTime };
  };

  const load = async () => {
    if (mockEnabled) {
      const nextTx = buildMockTx();
      setItems((prev) => [nextTx, ...prev].slice(0, 15));
      setToasts((prev) => [
        `Incoming Ksh ${nextTx.amount} from ${
          nextTx.payerName || nextTx.phoneNumber
        }`,
        ...prev,
      ]);
      setKpis(buildMockKpis());
      return;
    }
    try {
      setError("");
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(to).toISOString();
      const [txRes, kpiRes] = await Promise.all([
        api.get("/payments/transactions", { params }),
        api.get("/payments/kpis"),
      ]);
      const data: Transaction[] = txRes.data;
      if (data.length > 0) {
        const latestId = data[0].id;
        if (lastSeenRef.current && latestId !== lastSeenRef.current) {
          const newOnes = data.filter(
            (tx) => tx.id !== lastSeenRef.current && tx.status === "PAID"
          );
          if (newOnes.length > 0) {
            setToasts((prev) => [
              ...newOnes.map(
                (tx) =>
                  `Incoming Ksh ${tx.amount} from ${
                    tx.payerName || tx.phoneNumber
                  }`
              ),
              ...prev,
            ]);
          }
        }
        lastSeenRef.current = latestId;
      }
      setItems(data);
      setKpis(kpiRes.data);
    } catch (error) {
      setError("Live transactions unavailable. Check API connection.");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, mockEnabled ? 12000 : 10000);
    return () => clearInterval(timer);
  }, [mockEnabled, status, from, to]);

  const visibleItems = status
    ? items.filter((item) => item.status === status)
    : items;

  const currentKpi = useMemo(() => {
    if (!kpis) return null;
    if (kpiRange === "today") {
      return {
        label: "Today",
        current: kpis.today,
        previous: kpis.yesterday,
      };
    }
    if (kpiRange === "last7") {
      return {
        label: "Last 7 Days",
        current: kpis.last7,
        previous: kpis.prev7,
      };
    }
    return {
      label: "All Time",
      current: kpis.allTime,
      previous: kpis.last30,
    };
  }, [kpis, kpiRange]);

  const trend = useMemo(() => {
    if (!currentKpi || currentKpi.previous.amount === 0) return null;
    const delta =
      ((currentKpi.current.amount - currentKpi.previous.amount) /
        currentKpi.previous.amount) *
      100;
    return Math.round(delta * 10) / 10;
  }, [currentKpi]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div>
      <h2 className="page-title">Transactions</h2>
      <p className="subtle">
        Review incoming payments and statuses.
        {mockEnabled && " (mock data)"}
      </p>
      {error && <p className="subtle">{error}</p>}
      <div className="card demo-card kpi-card">
        <div className="kpi-tabs">
          <button
            className={kpiRange === "today" ? "tab active" : "tab"}
            onClick={() => setKpiRange("today")}
          >
            Today
          </button>
          <button
            className={kpiRange === "last7" ? "tab active" : "tab"}
            onClick={() => setKpiRange("last7")}
          >
            7 Days
          </button>
          <button
            className={kpiRange === "allTime" ? "tab active" : "tab"}
            onClick={() => setKpiRange("allTime")}
          >
            All Time
          </button>
        </div>
        {currentKpi ? (
          <div className="kpi-body">
            <div>
              <p className="kpi-label">{currentKpi.label} Collection</p>
              <p className="kpi-value">
                {formatMoney(currentKpi.current.amount)}
              </p>
              <p className="subtle">
                {currentKpi.current.count} payments
              </p>
            </div>
            <div className="kpi-trend">
              <span
                className={
                  trend !== null && trend >= 0 ? "trend up" : "trend down"
                }
              >
                {trend === null ? "—" : `${trend >= 0 ? "+" : ""}${trend}%`}
              </span>
              <span className="subtle">vs previous period</span>
            </div>
          </div>
        ) : (
          <p className="subtle">Loading collection totals...</p>
        )}
      </div>
      <div className="card">
        <div className="filter-row">
          <label>Status filter</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="FAILED">FAILED</option>
          </select>
          <label>From</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label>To</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button onClick={load}>Refresh</button>
          <button
            onClick={async () => {
              try {
                setError("");
                const exportParams: Record<string, string> = {};
                if (status) exportParams.status = status;
                if (from) exportParams.from = new Date(from).toISOString();
                if (to) exportParams.to = new Date(to).toISOString();
                const res = await api.get("/payments/transactions", {
                  params: exportParams,
                });
                const rows: Transaction[] = res.data ?? [];
                const header = [
                  "id",
                  "phoneNumber",
                  "payerName",
                  "amount",
                  "box",
                  "status",
                  "createdAt",
                ];
                const csv = [
                  header.join(","),
                  ...rows.map((row) =>
                    [
                      row.id,
                      row.phoneNumber,
                      row.payerName ?? "",
                      row.amount,
                      row.box ?? "",
                      row.status,
                      row.createdAt,
                    ]
                      .map((value) =>
                        `"${String(value).replace(/"/g, '""')}"`
                      )
                      .join(",")
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `transactions-${new Date().toISOString()}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              } catch {
                setError("Export failed. Check API connection.");
              }
            }}
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Amount</th>
              <th>Box</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id}>
                <td>{item.payerName || "—"}</td>
                <td className="mono">{item.phoneNumber}</td>
                <td>{formatMoney(item.amount)}</td>
                <td>{item.box}</td>
                <td>
                  <span
                    className={`status-pill status-${item.status.toLowerCase()}`}
                  >
                    <span className="status-dot" />
                    {item.status}
                  </span>
                </td>
                <td className="table-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
