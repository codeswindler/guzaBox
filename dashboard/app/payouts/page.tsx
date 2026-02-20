"use client";

import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import * as XLSX from "xlsx";

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

type DailyCollection = {
  date: string; // ISO date string (YYYY-MM-DD)
  totalCollected: number;
  budget: number;
  totalReleased: number;
  percentage: number; // percentage of collections paid out
  amountRetained: number;
  isToday: boolean; // true if this is today's date
};

type Winner = {
  id: string;
  amount: number;
  createdAt: string;
  transaction: {
    phoneNumber: string;
    payerName?: string | null;
    amount: number;
    box: string | null;
  };
};

type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ITEMS_PER_PAGE = 20;

export default function PayoutsPage() {
  const [collections, setCollections] = useState<DailyCollection[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [collectionsPagination, setCollectionsPagination] = useState<PaginationInfo | null>(null);
  const [winnersPagination, setWinnersPagination] = useState<PaginationInfo | null>(null);
  const [error, setError] = useState("");

  // Collections filters
  const [collectionsPage, setCollectionsPage] = useState(1);
  const [collectionsFrom, setCollectionsFrom] = useState("");
  const [collectionsTo, setCollectionsTo] = useState("");
  const [showCollectionsDatePicker, setShowCollectionsDatePicker] = useState(false);
  const collectionsDatePickerRef = useRef<HTMLDivElement>(null);

  // Winners filters
  const [winnersPage, setWinnersPage] = useState(1);
  const [winnersFrom, setWinnersFrom] = useState("");
  const [winnersTo, setWinnersTo] = useState("");
  const [showWinnersDatePicker, setShowWinnersDatePicker] = useState(false);
  const winnersDatePickerRef = useRef<HTMLDivElement>(null);

  useClickOutside(collectionsDatePickerRef, () => {
    if (showCollectionsDatePicker) {
      setShowCollectionsDatePicker(false);
    }
  });

  useClickOutside(winnersDatePickerRef, () => {
    if (showWinnersDatePicker) {
      setShowWinnersDatePicker(false);
    }
  });

  const loadCollections = async () => {
    try {
      setError("");
      const params: Record<string, string> = {
        page: collectionsPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      };
      if (collectionsFrom) params.from = collectionsFrom;
      if (collectionsTo) params.to = collectionsTo;

      const res = await api.get("/payouts/daily-collections", { params });
      const response = res.data;
      if (response && response.data) {
        setCollections(response.data);
        setCollectionsPagination(response.pagination || null);
      } else {
        // Fallback for old API format
        setCollections(Array.isArray(response) ? response : []);
        setCollectionsPagination(null);
      }
    } catch (err: any) {
      setError("Failed to load collections. Ensure API access.");
      setCollections([]);
      setCollectionsPagination(null);
    }
  };

  const loadWinners = async () => {
    try {
      setError("");
      const params: Record<string, string> = {
        instantOnly: "true",
        page: winnersPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      };
      if (winnersFrom) params.from = winnersFrom;
      if (winnersTo) params.to = winnersTo;

      const res = await api.get("/payouts/winners", { params });
      const response = res.data;
      if (response && response.data) {
        setWinners(response.data);
        setWinnersPagination(response.pagination || null);
      } else {
        // Fallback for old API format
        setWinners(Array.isArray(response) ? response : []);
        setWinnersPagination(null);
      }
    } catch (err: any) {
      setError("Failed to load winners. Ensure API access.");
      setWinners([]);
      setWinnersPagination(null);
    }
  };

  const load = async () => {
    await Promise.all([loadCollections(), loadWinners()]);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [collectionsPage, collectionsFrom, collectionsTo, winnersPage, winnersFrom, winnersTo]);

  const formatMoney = (value: number | string | null | undefined) => {
    // TypeORM decimal columns are returned as strings in JSON
    // Convert to number if it's a string
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    
    if (!Number.isFinite(numValue) || isNaN(numValue) || numValue == null) {
      return "Ksh 0";
    }
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const formatPercent = (value: number, digits = 1) => {
    if (!Number.isFinite(value) || isNaN(value)) return "—";
    return `${value.toFixed(digits)}%`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isLive = (collection: DailyCollection) => {
    if (!collection.isToday) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    return now < endOfDay;
  };

  const exportCollectionsToExcel = async () => {
    try {
      setError("");
      const params: Record<string, string> = {};
      if (collectionsFrom) params.from = collectionsFrom;
      if (collectionsTo) params.to = collectionsTo;
      // Fetch all data for export (no pagination)
      const res = await api.get("/payouts/daily-collections", { params });
      const response = res.data;
      const data = response?.data || (Array.isArray(response) ? response : []);

      const worksheetData = [
        ["Date", "Total Collected", "Budget", "Percentage", "Amount Retained"],
        ...data.map((c: DailyCollection) => [
          formatDate(c.date),
          c.totalCollected,
          c.budget,
          c.percentage.toFixed(2) + "%",
          c.amountRetained,
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Collections");

      const fileName = `collections-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err: any) {
      setError("Failed to export collections. Check API connection.");
    }
  };

  const exportWinnersToExcel = async () => {
    try {
      setError("");
      const params: Record<string, string> = { instantOnly: "true" };
      if (winnersFrom) params.from = winnersFrom;
      if (winnersTo) params.to = winnersTo;
      // Fetch all data for export (no pagination)
      const res = await api.get("/payouts/winners", { params });
      const response = res.data;
      const data = response?.data || (Array.isArray(response) ? response : []);

      const worksheetData = [
        ["Name", "Phone", "Stake", "Win Amount", "Box", "Date"],
        ...data.map((w: Winner) => [
          w.transaction.payerName || "—",
          w.transaction.phoneNumber,
          w.transaction.amount,
          w.amount,
          w.transaction.box || "—",
          new Date(w.createdAt).toLocaleString(),
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Winners");

      const fileName = `winners-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err: any) {
      setError("Failed to export winners. Check API connection.");
    }
  };

  const clearCollectionsFilters = () => {
    setCollectionsFrom("");
    setCollectionsTo("");
    setCollectionsPage(1);
  };

  const clearWinnersFilters = () => {
    setWinnersFrom("");
    setWinnersTo("");
    setWinnersPage(1);
  };

  return (
    <div>
      <h2 className="page-title">Collections & Payouts</h2>
      <p className="subtle">
        Daily collection and payout statistics for instant gratification system.
      </p>
      {error && <p className="subtle" style={{ color: "#ef4444" }}>{error}</p>}

      <div className="card demo-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3>Collections</h3>
            <p className="subtle">Daily collection and payout statistics</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative" }} ref={collectionsDatePickerRef}>
              <button
                onClick={() => setShowCollectionsDatePicker(!showCollectionsDatePicker)}
                style={{
                  padding: "8px 16px",
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                {collectionsFrom || collectionsTo ? "📅 Filtered" : "📅 Filter Dates"}
              </button>
              {showCollectionsDatePicker && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "8px",
                    background: "#1a1a1a",
                    border: "1px solid #7c3aed",
                    borderRadius: "8px",
                    padding: "16px",
                    zIndex: 10000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    minWidth: "280px",
                  }}
                >
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem" }}>
                      From Date
                    </label>
                    <input
                      type="date"
                      value={collectionsFrom}
                      onChange={(e) => setCollectionsFrom(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        color: "white",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem" }}>
                      To Date
                    </label>
                    <input
                      type="date"
                      value={collectionsTo}
                      onChange={(e) => setCollectionsTo(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        color: "white",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={clearCollectionsFilters}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        background: "#444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowCollectionsDatePicker(false)}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        background: "#7c3aed",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={exportCollectionsToExcel}
              style={{
                padding: "8px 16px",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              📊 Export Excel
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Collected</th>
              <th>Budget</th>
              <th>Percentage</th>
              <th>Amount Retained</th>
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-muted" style={{ textAlign: "center" }}>
                  No collection data available
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr key={collection.date}>
                  <td>
                    {formatDate(collection.date)}
                    {isLive(collection) && (
                      <span
                        style={{
                          marginLeft: "8px",
                          padding: "2px 8px",
                          background: "#10b981",
                          color: "white",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        LIVE
                      </span>
                    )}
                  </td>
                  <td>{formatMoney(collection.totalCollected)}</td>
                  <td>{formatMoney(collection.budget)}</td>
                  <td>{formatPercent(collection.percentage)}</td>
                  <td>{formatMoney(collection.amountRetained)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {collectionsPagination && collectionsPagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #333" }}>
            <div className="subtle" style={{ fontSize: "0.875rem" }}>
              Showing {((collectionsPagination.page - 1) * collectionsPagination.limit) + 1} to{" "}
              {Math.min(collectionsPagination.page * collectionsPagination.limit, collectionsPagination.total)} of{" "}
              {collectionsPagination.total} records
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setCollectionsPage(Math.max(1, collectionsPage - 1))}
                disabled={collectionsPage === 1}
                style={{
                  padding: "6px 12px",
                  background: collectionsPage === 1 ? "#444" : "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: collectionsPage === 1 ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Previous
              </button>
              <span style={{ padding: "6px 12px", fontSize: "0.875rem" }}>
                Page {collectionsPagination.page} of {collectionsPagination.totalPages}
              </span>
              <button
                onClick={() => setCollectionsPage(Math.min(collectionsPagination.totalPages, collectionsPage + 1))}
                disabled={collectionsPage >= collectionsPagination.totalPages}
                style={{
                  padding: "6px 12px",
                  background: collectionsPage >= collectionsPagination.totalPages ? "#444" : "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: collectionsPage >= collectionsPagination.totalPages ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card demo-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3>Winners</h3>
            <p className="subtle">Instant gratification winners</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative" }} ref={winnersDatePickerRef}>
              <button
                onClick={() => setShowWinnersDatePicker(!showWinnersDatePicker)}
                style={{
                  padding: "8px 16px",
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                {winnersFrom || winnersTo ? "📅 Filtered" : "📅 Filter Dates"}
              </button>
              {showWinnersDatePicker && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "8px",
                    background: "#1a1a1a",
                    border: "1px solid #7c3aed",
                    borderRadius: "8px",
                    padding: "16px",
                    zIndex: 10000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    minWidth: "280px",
                  }}
                >
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem" }}>
                      From Date
                    </label>
                    <input
                      type="date"
                      value={winnersFrom}
                      onChange={(e) => setWinnersFrom(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        color: "white",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem" }}>
                      To Date
                    </label>
                    <input
                      type="date"
                      value={winnersTo}
                      onChange={(e) => setWinnersTo(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        color: "white",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={clearWinnersFilters}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        background: "#444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowWinnersDatePicker(false)}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        background: "#7c3aed",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={exportWinnersToExcel}
              style={{
                padding: "8px 16px",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              📊 Export Excel
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Stake</th>
              <th>Win Amount</th>
              <th>Box</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {winners.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-muted" style={{ textAlign: "center" }}>
                  No winners yet
                </td>
              </tr>
            ) : (
              winners.map((winner) => (
                <tr key={winner.id}>
                  <td>{winner.transaction.payerName || "—"}</td>
                  <td className="mono">{winner.transaction.phoneNumber}</td>
                  <td>{formatMoney(winner.transaction.amount)}</td>
                  <td>{formatMoney(winner.amount)}</td>
                  <td>{winner.transaction.box || "—"}</td>
                  <td className="table-muted">
                    {new Date(winner.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {winnersPagination && winnersPagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #333" }}>
            <div className="subtle" style={{ fontSize: "0.875rem" }}>
              Showing {((winnersPagination.page - 1) * winnersPagination.limit) + 1} to{" "}
              {Math.min(winnersPagination.page * winnersPagination.limit, winnersPagination.total)} of{" "}
              {winnersPagination.total} records
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setWinnersPage(Math.max(1, winnersPage - 1))}
                disabled={winnersPage === 1}
                style={{
                  padding: "6px 12px",
                  background: winnersPage === 1 ? "#444" : "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: winnersPage === 1 ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Previous
              </button>
              <span style={{ padding: "6px 12px", fontSize: "0.875rem" }}>
                Page {winnersPagination.page} of {winnersPagination.totalPages}
              </span>
              <button
                onClick={() => setWinnersPage(Math.min(winnersPagination.totalPages, winnersPage + 1))}
                disabled={winnersPage >= winnersPagination.totalPages}
                style={{
                  padding: "6px 12px",
                  background: winnersPage >= winnersPagination.totalPages ? "#444" : "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: winnersPage >= winnersPagination.totalPages ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
