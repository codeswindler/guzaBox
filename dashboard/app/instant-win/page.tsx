"use client";

import { useEffect, useState } from "react";
import api from "../../lib/api";

type InstantWinStatus = {
  enabled: boolean;
  settings: {
    baseProbability: number;
    maxPercentage: number;
    minAmount: number;
    maxAmount: number;
  };
  todayStats: {
    totalCollected: number;
    prizePoolLimit: number;
    totalPrizesPaid: number;
    remainingBudget: number;
    currentProbability: number;
    budgetUsagePercentage: number;
  };
};

export default function InstantWinPage() {
  const [status, setStatus] = useState<InstantWinStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [settings, setSettings] = useState({
    baseProbability: 0.1,
    maxPercentage: 10,
    minAmount: 100,
    maxAmount: 1000,
  });

  const loadStatus = async () => {
    try {
      setError("");
      const res = await api.get("/admin/instant-win/status");
      setStatus(res.data);
      setSettings(res.data.settings);
    } catch (err: any) {
      setError("Failed to load instant win status");
    }
  };

  const toggleInstantWin = async (enabled: boolean) => {
    setLoading(true);
    setMessage("");
    try {
      const reason = enabled ? "Manual activation" : "Manual deactivation";
      await api.post("/admin/instant-win/toggle", { enabled, reason });
      setMessage(`Instant wins ${enabled ? "enabled" : "disabled"} successfully`);
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to toggle instant wins");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async () => {
    setLoading(true);
    setMessage("");
    try {
      await api.post("/admin/instant-win/settings", settings);
      setMessage("Instant win settings updated successfully");
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 10000);
    return () => clearInterval(timer);
  }, []);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  const formatPercent = (value: number, digits = 1) => {
    if (!Number.isFinite(value)) return "—";
    return `${(value * 100).toFixed(digits)}%`;
  };

  return (
    <div>
      <h2 className="page-title">Instant Gratification Control</h2>
      <p className="subtle">
        Control instant wins and prize budget in real-time.
      </p>
      
      {error && <p className="subtle" style={{ color: 'red' }}>{error}</p>}
      {message && <p className="subtle" style={{ color: 'green' }}>{message}</p>}

      {status && (
        <>
          {/* Status Card */}
          <div className="card demo-card">
            <h3>Current Status</h3>
            <div className="stat-grid">
              <div className="card demo-card">
                <p className="kpi-label">Instant Wins</p>
                <p className="kpi-value" style={{ 
                  color: status.enabled ? '#10b981' : '#ef4444',
                  fontSize: '2rem'
                }}>
                  {status.enabled ? "ENABLED" : "DISABLED"}
                </p>
                <p className="subtle">
                  {status.enabled ? "Players can win instantly" : "All players lose"}
                </p>
              </div>
              
              <div className="card demo-card">
                <p className="kpi-label">Today's Collections</p>
                <p className="kpi-value">{formatMoney(status.todayStats.totalCollected)}</p>
                <p className="subtle">Total amount collected today</p>
              </div>
              
              <div className="card demo-card">
                <p className="kpi-label">Prize Pool</p>
                <p className="kpi-value">{formatMoney(status.todayStats.prizePoolLimit)}</p>
                <p className="subtle">{status.settings.maxPercentage}% of collections</p>
              </div>
              
              <div className="card demo-card">
                <p className="kpi-label">Remaining Budget</p>
                <p className="kpi-value" style={{ 
                  color: status.todayStats.remainingBudget > 0 ? '#10b981' : '#ef4444'
                }}>
                  {formatMoney(status.todayStats.remainingBudget)}
                </p>
                <p className="subtle">
                  {status.todayStats.budgetUsagePercentage}% used
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={() => toggleInstantWin(!status.enabled)}
                disabled={loading}
                style={{
                  backgroundColor: status.enabled ? '#ef4444' : '#10b981',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? "Processing..." : (status.enabled ? "DISABLE INSTANT WINS" : "ENABLE INSTANT WINS")}
              </button>
            </div>
          </div>

          {/* Settings Card */}
          <div className="card demo-card">
            <h3>Instant Win Settings</h3>
            <div className="input-row">
              <label>Base Probability</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.baseProbability}
                onChange={(e) => setSettings({...settings, baseProbability: Number(e.target.value)})}
              />
              <span className="subtle">{formatPercent(settings.baseProbability)} chance per game</span>
            </div>
            
            <div className="input-row">
              <label>Max Prize Percentage</label>
              <input
                type="number"
                step="1"
                min="1"
                max="50"
                value={settings.maxPercentage}
                onChange={(e) => setSettings({...settings, maxPercentage: Number(e.target.value)})}
              />
              <span className="subtle">% of collections for prizes</span>
            </div>
            
            <div className="input-row">
              <label>Min Prize Amount</label>
              <input
                type="number"
                step="50"
                min="50"
                max="10000"
                value={settings.minAmount}
                onChange={(e) => setSettings({...settings, minAmount: Number(e.target.value)})}
              />
              <span className="subtle">Minimum instant prize</span>
            </div>
            
            <div className="input-row">
              <label>Max Prize Amount</label>
              <input
                type="number"
                step="50"
                min="50"
                max="50000"
                value={settings.maxAmount}
                onChange={(e) => setSettings({...settings, maxAmount: Number(e.target.value)})}
              />
              <span className="subtle">Maximum instant prize</span>
            </div>
            
            <button 
              onClick={updateSettings}
              disabled={loading}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '20px'
              }}
            >
              {loading ? "Updating..." : "UPDATE SETTINGS"}
            </button>
          </div>

          {/* Real-time Stats */}
          <div className="card demo-card">
            <h3>Real-time Statistics</h3>
            <div className="stat-grid">
              <div className="card demo-card">
                <p className="kpi-label">Current Probability</p>
                <p className="kpi-value">{formatPercent(status.todayStats.currentProbability)}</p>
                <p className="subtle">Adjusted based on remaining budget</p>
              </div>
              
              <div className="card demo-card">
                <p className="kpi-label">Prizes Paid Today</p>
                <p className="kpi-value">{formatMoney(status.todayStats.totalPrizesPaid)}</p>
                <p className="subtle">Total instant wins paid</p>
              </div>
              
              <div className="card demo-card">
                <p className="kpi-label">Budget Usage</p>
                <p className="kpi-value">{status.todayStats.budgetUsagePercentage}%</p>
                <p className="subtle">Of prize pool limit</p>
              </div>
              
              <div className="card demo-card">
                <p className="kpi-label">Auto-adjustment</p>
                <p className="kpi-value" style={{ 
                  color: status.todayStats.budgetUsagePercentage > 80 ? '#ef4444' : '#10b981'
                }}>
                  {status.todayStats.budgetUsagePercentage > 80 ? 'REDUCED' : 'NORMAL'}
                </p>
                <p className="subtle">
                  {status.todayStats.budgetUsagePercentage > 80 
                    ? 'Probability reduced to protect budget' 
                    : 'Normal probability active'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
