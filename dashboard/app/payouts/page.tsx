"use client";

import { useEffect, useState } from "react";
import api from "../../lib/api";

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

export default function PayoutsPage() {
  const [collections, setCollections] = useState<DailyCollection[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const [collectionsRes, winnersRes] = await Promise.all([
        api.get("/payouts/daily-collections"),
        api.get("/payouts/winners", { params: { instantOnly: "true" } }),
      ]);
      setCollections(collectionsRes.data ?? []);
      setWinners(winnersRes.data ?? []);
    } catch (err: any) {
      setError("Failed to load data. Ensure API access.");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <div>
      <h2 className="page-title">Collections & Payouts</h2>
      <p className="subtle">
        Daily collection and payout statistics for instant gratification system.
      </p>
      {error && <p className="subtle" style={{ color: "#ef4444" }}>{error}</p>}

      <div className="card demo-card">
        <h3>Collections</h3>
        <p className="subtle">
          Daily collection and payout statistics
        </p>
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
      </div>

      <div className="card demo-card">
        <h3>Winners</h3>
        <p className="subtle">
          Instant gratification winners
        </p>
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
      </div>
    </div>
  );
}
