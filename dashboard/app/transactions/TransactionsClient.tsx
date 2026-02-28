"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

// Hook to detect clicks outside an element
function useClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, handler]);
}

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

const ZERO_KPI: KpiBlock = { count: 0, amount: 0 };

const normalizeKpiBlock = (value: unknown): KpiBlock => {
  if (!value || typeof value !== "object") return ZERO_KPI;
  const candidate = value as { count?: unknown; amount?: unknown };
  const count =
    typeof candidate.count === "number" && Number.isFinite(candidate.count)
      ? candidate.count
      : 0;
  const amount =
    typeof candidate.amount === "number" && Number.isFinite(candidate.amount)
      ? candidate.amount
      : 0;
  return { count, amount };
};

const normalizeKpis = (value: unknown): Kpis => {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    today: normalizeKpiBlock(source.today),
    yesterday: normalizeKpiBlock(source.yesterday),
    last7: normalizeKpiBlock(source.last7),
    prev7: normalizeKpiBlock(source.prev7),
    last30: normalizeKpiBlock(source.last30),
    prev30: normalizeKpiBlock(source.prev30),
    allTime: normalizeKpiBlock(source.allTime),
  };
};

const ITEMS_PER_PAGE = 50;

export default function TransactionsClient() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toasts, setToasts] = useState<string[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [kpiRange, setKpiRange] = useState<"today" | "last7" | "allTime" | "custom">(
    "today"
  );
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, right: 0 });
  const customDatePickerRef = useRef<HTMLDivElement>(null);
  const customButtonRef = useRef<HTMLButtonElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  useClickOutside(customDatePickerRef, () => {
    if (showCustomDatePicker) {
      setShowCustomDatePicker(false);
    }
  });
  const envMock = process.env.NEXT_PUBLIC_MOCK_DATA === "true";
  const [mockEnabled, setMockEnabled] = useState(envMock);
  const [error, setError] = useState("");

  const toSqlDateTime = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  };

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
      const params: Record<string, string> = {
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      };
      if (status) params.status = status;
      const fromValue = toSqlDateTime(from);
      const toValue = toSqlDateTime(to);
      if (fromValue) params.from = fromValue;
      if (toValue) params.to = toValue;
      const [txRes, kpiRes] = await Promise.all([
        api.get("/payments/transactions", { params }),
        api.get("/payments/kpis"),
      ]);
      
      // Handle new paginated response format
      let data: Transaction[] = [];
      if (txRes.data && txRes.data.data && Array.isArray(txRes.data.data)) {
        // New paginated format
        data = txRes.data.data;
        setPagination(txRes.data.pagination || null);
      } else if (Array.isArray(txRes.data)) {
        // Fallback to old format
        data = txRes.data;
        setPagination(null);
      }
      
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
      setKpis(normalizeKpis(kpiRes.data));
    } catch (error) {
      setError("Live transactions unavailable. Check API connection.");
    }
  };

  const [customKpi, setCustomKpi] = useState<KpiBlock | null>(null);
  const [customKpiLoading, setCustomKpiLoading] = useState(false);

  const loadCustomKpi = async () => {
    if (!customStartDate || !customEndDate) {
      setCustomKpi(null);
      return;
    }
    setCustomKpiLoading(true);
    try {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      
      const fromValue = toSqlDateTime(start.toISOString());
      const toValue = toSqlDateTime(end.toISOString());
      
      const params: Record<string, string> = { status: "PAID" };
      if (fromValue) params.from = fromValue;
      if (toValue) params.to = toValue;
      
      const res = await api.get("/payments/transactions", { params });
      const data: Transaction[] = Array.isArray(res.data) ? res.data : [];
      const amount = data.reduce((sum, tx) => {
        const txAmount = Number(tx.amount);
        return sum + (Number.isFinite(txAmount) ? txAmount : 0);
      }, 0);
      setCustomKpi({ 
        count: data.length, 
        amount: Number.isFinite(amount) ? amount : 0 
      });
    } catch (error) {
      setError("Failed to load custom date range data.");
      setCustomKpi(null);
    } finally {
      setCustomKpiLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [status, from, to]);

  useEffect(() => {
    load();
    const timer = setInterval(load, mockEnabled ? 12000 : 10000);
    return () => clearInterval(timer);
  }, [mockEnabled, status, from, to, currentPage]);

  useEffect(() => {
    if (kpiRange === "custom" && customStartDate && customEndDate) {
      loadCustomKpi();
    } else if (kpiRange !== "custom") {
      setCustomKpi(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiRange, customStartDate, customEndDate]);

  // No need to filter client-side since we're paginating server-side
  const visibleItems = items;

  const currentKpi = useMemo(() => {
    if (kpiRange === "custom") {
      if (customKpiLoading) {
        return {
          label: "Custom Range",
          current: { count: 0, amount: 0 },
          previous: { count: 0, amount: 0 },
        };
      }
      if (customKpi) {
        const safeAmount = Number.isFinite(customKpi.amount) ? customKpi.amount : 0;
        const safeCount = Number.isFinite(customKpi.count) ? customKpi.count : 0;
        return {
          label: customStartDate && customEndDate 
            ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
            : "Custom Range",
          current: { count: safeCount, amount: safeAmount },
          previous: { count: 0, amount: 0 }, // No comparison for custom range
        };
      }
      return {
        label: "Custom Range",
        current: { count: 0, amount: 0 },
        previous: { count: 0, amount: 0 },
      };
    }
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
  }, [kpis, kpiRange, customKpi, customKpiLoading, customStartDate, customEndDate]);

  const trend = useMemo(() => {
    if (!currentKpi || currentKpi.previous.amount === 0 || kpiRange === "custom") return null;
    const delta =
      ((currentKpi.current.amount - currentKpi.previous.amount) /
        currentKpi.previous.amount) *
      100;
    return Math.round(delta * 10) / 10;
  }, [currentKpi, kpiRange]);

  const formatMoney = (value: number) => {
    if (!Number.isFinite(value) || isNaN(value)) {
      return "Ksh 0";
    }
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDateTime = (dateStr: string | Date) => {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    return date.toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div>
      <h2 className="page-title">Transactions</h2>
      <p className="subtle">
        Review incoming payments and statuses.
        {mockEnabled && " (mock data)"}
      </p>
      {error && <p className="subtle">{error}</p>}
      <div className="card demo-card kpi-card">
        <div className="kpi-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className={kpiRange === "today" ? "tab active" : "tab"}
              onClick={() => {
                setKpiRange("today");
                setShowCustomDatePicker(false);
              }}
            >
              Today
            </button>
            <button
              className={kpiRange === "last7" ? "tab active" : "tab"}
              onClick={() => {
                setKpiRange("last7");
                setShowCustomDatePicker(false);
              }}
            >
              7 Days
            </button>
            <button
              className={kpiRange === "allTime" ? "tab active" : "tab"}
              onClick={() => {
                setKpiRange("allTime");
                setShowCustomDatePicker(false);
              }}
            >
              All Time
            </button>
          </div>
          <div style={{ position: "relative" }} ref={customDatePickerRef}>
            <button
              ref={customButtonRef}
              className={kpiRange === "custom" ? "tab active" : "tab"}
              onClick={() => {
                setKpiRange("custom");
                if (!showCustomDatePicker && customButtonRef.current) {
                  const rect = customButtonRef.current.getBoundingClientRect();
                  setDatePickerPosition({
                    top: rect.bottom + window.scrollY + 8,
                    right: window.innerWidth - rect.right
                  });
                }
                setShowCustomDatePicker(!showCustomDatePicker);
              }}
            >
              Custom
            </button>
            {showCustomDatePicker && kpiRange === "custom" && (
              <div style={{
                position: "fixed",
                top: `${datePickerPosition.top}px`,
                right: `${datePickerPosition.right}px`,
                padding: "1rem",
                background: "rgba(15, 23, 42, 0.98)",
                border: "1px solid rgba(148, 163, 184, 0.4)",
                borderRadius: "0.5rem",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                minWidth: "250px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)",
                backdropFilter: "blur(12px)"
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.875rem", color: "var(--text-muted, #999)" }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{
                      padding: "0.5rem",
                      background: "var(--input-bg, #0f0f1e)",
                      border: "1px solid var(--border-color, #333)",
                      borderRadius: "0.25rem",
                      color: "var(--text-color, #fff)"
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.875rem", color: "var(--text-muted, #999)" }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{
                      padding: "0.5rem",
                      background: "var(--input-bg, #0f0f1e)",
                      border: "1px solid var(--border-color, #333)",
                      borderRadius: "0.25rem",
                      color: "var(--text-color, #fff)"
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      setShowCustomDatePicker(false);
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  style={{
                    padding: "0.5rem 1rem",
                    background: (!customStartDate || !customEndDate) 
                      ? "var(--border-color, #333)" 
                      : "var(--primary-color, #6366f1)",
                    border: "none",
                    borderRadius: "0.25rem",
                    color: "#fff",
                    cursor: (!customStartDate || !customEndDate) ? "not-allowed" : "pointer",
                    opacity: (!customStartDate || !customEndDate) ? 0.5 : 1
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
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
            onClick={() => {
              setStatus("");
              setFrom("");
              setTo("");
            }}
          >
            Clear Filters
          </button>
          <span className="subtle">
            {pagination
              ? `Found ${pagination.total} record${pagination.total === 1 ? "" : "s"} (Page ${pagination.page} of ${pagination.totalPages})`
              : `Found ${visibleItems.length} record${visibleItems.length === 1 ? "" : "s"}`}
          </span>
          <button
            onClick={async () => {
              try {
                setError("");
                const exportParams: Record<string, string> = {};
                if (status) exportParams.status = status;
                const exportFrom = toSqlDateTime(from);
                const exportTo = toSqlDateTime(to);
                if (exportFrom) exportParams.from = exportFrom;
                if (exportTo) exportParams.to = exportTo;
                const res = await api.get("/payments/transactions", {
                  params: exportParams,
                });
                // Handle both paginated and non-paginated responses
                const rows: Transaction[] = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
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
                  {formatDateTime(item.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && pagination.totalPages > 1 && (
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center" }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: "0.5rem 1rem" }}
            >
              Previous
            </button>
            <span className="subtle">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage >= pagination.totalPages}
              style={{ padding: "0.5rem 1rem" }}
            >
              Next
            </button>
          </div>
        )}
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
