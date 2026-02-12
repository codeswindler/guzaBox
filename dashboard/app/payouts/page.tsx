"use client";

import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

type Release = {
  id: string;
  percentage: number;
  minWin: number;
  maxWin: number;
  releaseBudget: number | null;
  totalReleased: number;
  totalWinners: number;
  createdAt: string;
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

type Kpis = {
  today: { count: number; amount: number };
};

type SinceRelease = {
  count: number;
  amount: number;
  sinceAt: string | null;
  isFirstRelease: boolean;
};

type Preview = {
  totals: {
    collectedToday: number;
    collectedCount: number;
    percentage: number;
    totalReleased: number;
    remainingBudget: number;
  };
  budget: number;
  minWin: number;
  maxWin: number;
  eligibleCount: number;
  leaderboard: {
    phoneNumber: string;
    payerName: string | null;
    totalPaid: number;
    count: number;
  }[];
  winners: {
    phoneNumber: string;
    payerName: string | null;
    totalPaid: number;
    count: number;
    amount: number;
  }[];
};

export default function PayoutsPage() {
  const [releaseBudget, setReleaseBudget] = useState(10000);
  const [minWin, setMinWin] = useState(50);
  const [maxWin, setMaxWin] = useState(200);
  const [releases, setReleases] = useState<Release[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [error, setError] = useState("");
  const [sinceRelease, setSinceRelease] = useState<SinceRelease>({
    count: 0,
    amount: 0,
    sinceAt: null,
    isFirstRelease: false,
  });

  const load = async () => {
    try {
      setError("");
      const [relRes, winRes, kpiRes] = await Promise.all([
        api.get("/payouts/releases"),
        api.get("/payouts/winners"),
        api.get("/payments/kpis"),
      ]);
      const nextReleases: Release[] = relRes.data ?? [];
      setReleases(nextReleases);
      setWinners(winRes.data);
      setKpis(kpiRes.data);

      if (nextReleases.length === 0) {
        setSinceRelease({
          count: kpiRes.data?.today.count ?? 0,
          amount: kpiRes.data?.today.amount ?? 0,
          sinceAt: null,
          isFirstRelease: true,
        });
        return;
      }

      const latestRelease = nextReleases.reduce((latest, release) =>
        new Date(release.createdAt).getTime() >
        new Date(latest.createdAt).getTime()
          ? release
          : latest
      );
      const from = new Date(latestRelease.createdAt).toISOString();
      const txRes = await api.get("/payments/transactions", {
        params: { status: "PAID", from },
      });
      const txs = txRes.data ?? [];
      const amount = txs.reduce(
        (sum: number, tx: { amount?: number }) => sum + Number(tx.amount ?? 0),
        0
      );
      setSinceRelease({
        count: txs.length,
        amount,
        sinceAt: latestRelease.createdAt,
        isFirstRelease: false,
      });
    } catch (err: any) {
      setError("Live payout statistics unavailable. Ensure API access.");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: unknown, digits = 1) => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return `${numeric.toFixed(digits)}%`;
  };

  const openPreview = async () => {
    setMessage("");
    try {
      const res = await api.post("/payouts/preview", {
        releaseBudget,
        minWin,
        maxWin,
        overrides: preview?.winners.map((winner) => ({
          phoneNumber: winner.phoneNumber,
          amount: winner.amount,
        })),
      });
      setPreview(res.data);
      setModalOpen(true);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to build preview.");
    }
  };

  const confirmRelease = async () => {
    if (!preview) return;
    setMessage("");
    try {
      await api.post("/payouts/releases", {
        releaseBudget,
        minWin,
        maxWin,
        overrides: preview.winners.map((winner) => ({
          phoneNumber: winner.phoneNumber,
          amount: winner.amount,
        })),
      });
      setMessage("Release executed.");
      setModalOpen(false);
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to release winners.");
    }
  };

  const totalOverride = useMemo(() => {
    if (!preview) return 0;
    return preview.winners.reduce((sum, winner) => sum + winner.amount, 0);
  }, [preview]);

  const updateWinnerAmount = (phoneNumber: string, amount: number) => {
    if (!preview) return;
    const nextWinners = preview.winners.map((winner) =>
      winner.phoneNumber === phoneNumber ? { ...winner, amount } : winner
    );
    const nextTotal = nextWinners.reduce((sum, winner) => sum + winner.amount, 0);
    setPreview({
      ...preview,
      winners: nextWinners,
      totals: {
        ...preview.totals,
        totalReleased: nextTotal,
        remainingBudget: Math.max(preview.budget - nextTotal, 0),
      },
    });
  };

  return (
    <div>
      <h2 className="page-title">Payouts</h2>
      <p className="subtle">
        <strong>Instant Gratification System Active</strong> - Manual releases disabled.
        <br />
        Use <strong>Instant Wins</strong> page for real-time control.
      </p>
      {error && <p className="subtle">{error}</p>}

      <div className="card demo-card" style={{ 
        backgroundColor: '#fef3c7', 
        border: '1px solid #f59e0b',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#92400e', marginBottom: '10px' }}>
          🎯 Instant Gratification Mode
        </h3>
        <p style={{ color: '#78350f', marginBottom: '15px' }}>
          All wins are processed instantly. Manual release system has been retired.
        </p>
        <a 
          href="/instant-win" 
          style={{
            display: 'inline-block',
            backgroundColor: '#10b981',
            color: 'white',
            padding: '12px 24px',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold'
          }}
        >
          Go to Instant Wins Control →
        </a>
      </div>

      <div className="card demo-card">
        <h3>Historical Release Data</h3>
        <p className="subtle">
          Previous manual releases (archived for reference only)
        </p>
        <table>
          <thead>
            <tr>
              <th>Budget</th>
              <th>Released</th>
              <th>Range</th>
              <th>Winners</th>
              <th>Percentage</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.id}>
                <td>{formatMoney(release.releaseBudget ?? 0)}</td>
                <td>{formatMoney(release.totalReleased)}</td>
                <td>
                  {release.minWin} - {release.maxWin}
                </td>
                <td>{release.totalWinners}</td>
                <td>{formatPercent(release.percentage)}</td>
                <td className="table-muted">
                  {new Date(release.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card demo-card">
        <h3>Winners</h3>
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
            {winners.map((winner) => (
              <tr key={winner.id}>
                <td>{winner.transaction.payerName || "—"}</td>
                <td className="mono">{winner.transaction.phoneNumber}</td>
                <td>{formatMoney(winner.transaction.amount)}</td>
                <td>{formatMoney(winner.amount)}</td>
                <td>{winner.transaction.box}</td>
                <td className="table-muted">
                  {new Date(winner.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
