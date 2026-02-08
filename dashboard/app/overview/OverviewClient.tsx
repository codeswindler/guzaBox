"use client";

import { useEffect, useState } from "react";
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

type Release = {
  totalWinners: number;
};

export default function OverviewClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState("");

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  const load = async () => {
    try {
      setError("");
      const [overviewRes, releasesRes] = await Promise.all([
        api.get("/analytics/overview"),
        api.get("/payouts/releases"),
      ]);
      setOverview(overviewRes.data);
      setReleases(releasesRes.data ?? []);
    } catch (err: any) {
      setError("Live overview unavailable. Ensure API access and seed data.");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const totalWinners = releases.reduce(
    (sum, release) => sum + Number(release.totalWinners ?? 0),
    0
  );

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <p className="subtle">
        Monitor collections, release winners, and test the USSD flow.
      </p>
      {error && <p className="subtle">{error}</p>}
      <div className="stat-grid">
        <div className="card demo-card">
          <div className="subtle">Total Collections</div>
          <div className="mono">
            {overview ? formatMoney(overview.allTime.paidAmount) : "--"}
          </div>
        </div>
        <div className="card demo-card">
          <div className="subtle">Paid Transactions</div>
          <div className="mono">
            {overview ? overview.allTime.paidCount : "--"}
          </div>
        </div>
        <div className="card demo-card">
          <div className="subtle">Winners Released</div>
          <div className="mono">
            {overview ? totalWinners : "--"}
          </div>
        </div>
      </div>
      <div className="card demo-card">
        <h3>Quick Actions</h3>
        <p className="subtle">
          Use the navigation above to view transactions, trigger releases, or
          validate the USSD menu.
        </p>
      </div>
    </div>
  );
}
