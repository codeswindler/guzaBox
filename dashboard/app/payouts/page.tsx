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
        Release today’s winners within your configured budget.
      </p>
      {error && <p className="subtle">{error}</p>}

      <div className="stat-grid">
        <div className="card demo-card">
          <p className="kpi-label">Collected Today</p>
          <p className="kpi-value">
            {formatMoney(kpis?.today.amount ?? 0)}
          </p>
          <p className="subtle">{kpis?.today.count ?? 0} payments</p>
        </div>
        <div className="card demo-card">
          <p className="kpi-label">Collected Since Last Release</p>
          <p className="kpi-value">{formatMoney(sinceRelease.amount)}</p>
          <p className="subtle">
            {sinceRelease.count} payments
            {sinceRelease.isFirstRelease ? " • First release" : ""}
          </p>
        </div>
        <div className="card demo-card">
          <p className="kpi-label">Release Budget</p>
          <p className="kpi-value">{formatMoney(releaseBudget)}</p>
          <p className="subtle">Based on today’s collection</p>
        </div>
      </div>

      <div className="card demo-card payout-controls">
        <div className="input-row">
          <label>Release Budget</label>
          <input
            type="number"
            value={releaseBudget}
            onChange={(e) => setReleaseBudget(Number(e.target.value))}
          />
        </div>
        <div className="input-row">
          <label>Min Win</label>
          <input
            type="number"
            value={minWin}
            onChange={(e) => setMinWin(Number(e.target.value))}
          />
        </div>
        <div className="input-row">
          <label>Max Win</label>
          <input
            type="number"
            value={maxWin}
            onChange={(e) => setMaxWin(Number(e.target.value))}
          />
        </div>
        <button onClick={openPreview}>Preview Release</button>
        {message && <p className="subtle">{message}</p>}
      </div>

      <div className="card demo-card">
        <h3>Release History</h3>
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

      {modalOpen && preview && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Release Preview</h3>
                <p className="subtle">
                  Review the budget split before confirming.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <div className="receipt">
              <div>
                <p className="kpi-label">Today Collected</p>
                <p className="kpi-value">
                  {formatMoney(preview.totals.collectedToday)}
                </p>
                <p className="subtle">
                  {preview.totals.collectedCount} payments
                </p>
              </div>
              <div>
                <p className="kpi-label">Budget</p>
                <p className="kpi-value">{formatMoney(preview.budget)}</p>
                <p className="subtle">
                  {formatPercent(preview.totals.percentage)} of today
                </p>
              </div>
              <div>
                <p className="kpi-label">Total Release</p>
                <p className="kpi-value">
                  {formatMoney(preview.totals.totalReleased)}
                </p>
                <p className="subtle">
                  Remaining {formatMoney(preview.totals.remainingBudget)}
                </p>
              </div>
            </div>

            <div className="preview-grid">
              <div className="card">
                <h4>Ranked Players</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Total Paid</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.leaderboard.map((player) => (
                      <tr key={player.phoneNumber}>
                        <td>
                          {player.payerName || "—"}{" "}
                          <span className="table-muted">
                            ({player.phoneNumber})
                          </span>
                        </td>
                        <td>{formatMoney(player.totalPaid)}</td>
                        <td>{player.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h4>Proposed Winners</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Total Paid</th>
                      <th>Win Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.winners.map((winner) => (
                      <tr key={winner.phoneNumber}>
                        <td>
                          {winner.payerName || "—"}{" "}
                          <span className="table-muted">
                            ({winner.phoneNumber})
                          </span>
                        </td>
                        <td>{formatMoney(winner.totalPaid)}</td>
                        <td>
                          <input
                            type="number"
                            value={winner.amount}
                            onChange={(e) =>
                              updateWinnerAmount(
                                winner.phoneNumber,
                                Number(e.target.value)
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <span className="subtle">
                Total release: {formatMoney(totalOverride)}
              </span>
              <button onClick={confirmRelease}>Confirm Release</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
