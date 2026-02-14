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
    loserMessage: string;
    sendWinnerMessages: boolean;
  };
  todayStats: {
    totalCollected: number;
    prizePoolLimit: number;
    totalPrizesPaid: number;
    remainingBudget: number;
    currentProbability: number;
    budgetUsagePercentage: number;
  };
  anomaly?: {
    active: boolean;
    level: "normal" | "warn" | "critical";
    badge: string;
    description: string;
    checks: string[];
  };
};

const DEFAULT_STATUS: InstantWinStatus = {
  enabled: false,
  settings: {
    baseProbability: 0,
    maxPercentage: 0,
    minAmount: 0,
    maxAmount: 0,
    loserMessage: "Almost won. Try again.",
    sendWinnerMessages: false,
  },
  todayStats: {
    totalCollected: 0,
    prizePoolLimit: 0,
    totalPrizesPaid: 0,
    remainingBudget: 0,
    currentProbability: 0,
    budgetUsagePercentage: 0,
  },
  anomaly: {
    active: false,
    level: "normal",
    badge: "Healthy",
    description: "Budget usage is within normal operating range.",
    checks: [],
  },
};

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeStatus = (value: unknown): InstantWinStatus => {
  if (!value || typeof value !== "object") return DEFAULT_STATUS;
  const source = value as Record<string, any>;
  const config =
    source.config && typeof source.config === "object" ? source.config : {};
  const incomingSettings =
    source.settings && typeof source.settings === "object" ? source.settings : {};
  const incomingTodayStats =
    source.todayStats && typeof source.todayStats === "object"
      ? source.todayStats
      : {};

  const enabled =
    typeof source.enabled === "boolean"
      ? source.enabled
      : Boolean(config.instantWinEnabled ?? false);
  const settings = {
    baseProbability: toNumber(
      incomingSettings.baseProbability ?? config.instantWinBaseProbability
    ),
    maxPercentage: toNumber(
      incomingSettings.maxPercentage ?? config.instantWinPercentage
    ),
    minAmount: toNumber(incomingSettings.minAmount ?? config.instantWinMinAmount),
    maxAmount: toNumber(incomingSettings.maxAmount ?? config.instantWinMaxAmount),
    loserMessage: String(
      incomingSettings.loserMessage ?? config.loserMessage ?? "Almost won. Try again."
    ),
    sendWinnerMessages: Boolean(
      incomingSettings.sendWinnerMessages ?? config.sendWinnerMessages ?? false
    ),
  };
  const todayStats = {
    totalCollected: toNumber(incomingTodayStats.totalCollected),
    prizePoolLimit: toNumber(
      incomingTodayStats.prizePoolLimit,
      (settings.maxPercentage / 100) * toNumber(incomingTodayStats.totalCollected)
    ),
    totalPrizesPaid: toNumber(incomingTodayStats.totalPrizesPaid),
    remainingBudget: toNumber(
      incomingTodayStats.remainingBudget,
      toNumber(incomingTodayStats.prizePoolLimit) -
        toNumber(incomingTodayStats.totalPrizesPaid)
    ),
    currentProbability: toNumber(
      incomingTodayStats.currentProbability,
      settings.baseProbability
    ),
    budgetUsagePercentage: toNumber(
      incomingTodayStats.budgetUsagePercentage,
      0
    ),
  };

  const anomalySource =
    source.anomaly && typeof source.anomaly === "object" ? source.anomaly : {};
  const anomaly = {
    active: Boolean(anomalySource.active ?? false),
    level:
      anomalySource.level === "critical" || anomalySource.level === "warn"
        ? anomalySource.level
        : "normal",
    badge: String(anomalySource.badge ?? "Healthy"),
    description: String(
      anomalySource.description ?? "Budget usage is within normal operating range."
    ),
    checks: Array.isArray(anomalySource.checks)
      ? anomalySource.checks.map((item: unknown) => String(item))
      : [],
  };

  return { enabled, settings, todayStats, anomaly };
};

export default function InstantWinPage() {
  const [status, setStatus] = useState<InstantWinStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testB2cPhone, setTestB2cPhone] = useState("");
  const [testB2cAmount, setTestB2cAmount] = useState<number>(10);
  const [testB2cLoading, setTestB2cLoading] = useState(false);
  const [testB2cResult, setTestB2cResult] = useState("");
  const [testB2cError, setTestB2cError] = useState("");

  const [testLossPhone, setTestLossPhone] = useState("");
  const [testLossBox, setTestLossBox] = useState<number>(1);
  const [testLossLoading, setTestLossLoading] = useState(false);
  const [testLossResult, setTestLossResult] = useState("");
  const [testLossError, setTestLossError] = useState("");

  const [settings, setSettings] = useState({
    baseProbability: 0.1,
    maxPercentage: 10,
    minAmount: 100,
    maxAmount: 1000,
    loserMessage: "Almost won. Try again.",
    sendWinnerMessages: false,
  });

  const loadStatus = async () => {
    try {
      setError("");
      const res = await api.get("/admin/instant-win/status");
      const normalized = normalizeStatus(res.data);
      setStatus(normalized);
      setSettings(normalized.settings);
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

  const testB2c = async () => {
    setTestB2cLoading(true);
    setTestB2cError("");
    setTestB2cResult("");

    const phoneNumber = testB2cPhone.trim();
    const amount = Number(testB2cAmount);

    if (!phoneNumber) {
      setTestB2cError("Phone number is required");
      setTestB2cLoading(false);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTestB2cError("Amount must be a positive number");
      setTestB2cLoading(false);
      return;
    }

    try {
      const res = await api.post("/admin/instant-win/test-b2c", {
        phoneNumber,
        amount,
      });
      setTestB2cResult(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setTestB2cError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to initiate test B2C payout"
      );
    } finally {
      setTestB2cLoading(false);
    }
  };

  const testLossSms = async () => {
    setTestLossLoading(true);
    setTestLossError("");
    setTestLossResult("");

    const phoneNumber = testLossPhone.trim();
    const selectedBox = Number(testLossBox);

    if (!phoneNumber) {
      setTestLossError("Phone number is required");
      setTestLossLoading(false);
      return;
    }
    if (!Number.isFinite(selectedBox) || selectedBox < 1 || selectedBox > 5) {
      setTestLossError("Selected box must be between 1 and 5");
      setTestLossLoading(false);
      return;
    }

    try {
      const res = await api.post("/admin/instant-win/test-loss-sms", {
        phoneNumber,
        selectedBox,
      });
      setTestLossResult(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setTestLossError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to send test loss SMS"
      );
    } finally {
      setTestLossLoading(false);
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
          {status.anomaly?.active && (
            <div
              className="card demo-card"
              style={{
                border: `1px solid ${
                  status.anomaly.level === "critical" ? "#ef4444" : "#f59e0b"
                }`,
                backgroundColor:
                  status.anomaly.level === "critical" ? "#fee2e2" : "#fef3c7",
              }}
            >
              <p
                style={{
                  fontWeight: 700,
                  marginBottom: "8px",
                  color: status.anomaly.level === "critical" ? "#991b1b" : "#92400e",
                }}
              >
                {status.anomaly.level === "critical" ? "CRITICAL" : "WARNING"} ·{" "}
                {status.anomaly.badge}
              </p>
              <p style={{ marginBottom: "8px" }}>{status.anomaly.description}</p>
              {status.anomaly.checks.length > 0 && (
                <p className="subtle">
                  Check now: {status.anomaly.checks.join(" | ")}
                </p>
              )}
            </div>
          )}

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
              <span className="subtle">
                Tip: baseline chance per paid game before budget checks. Higher
                values create more winners and consume pool faster.
              </span>
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
              <span className="subtle">
                Tip: hard cap on payouts for the day. At 50, total prizes can
                never exceed 50% of today's paid collections.
              </span>
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
              <span className="subtle">
                Tip: minimum win amount. If remaining budget is below this,
                system auto-switches to loser outcomes.
              </span>
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
              <span className="subtle">
                Tip: upper bound per winning ticket. Keep this near your target
                economics to reduce variance.
              </span>
            </div>

            <div className="input-row">
              <label>Loser Message (Prefix)</label>
              <input
                type="text"
                maxLength={500}
                value={settings.loserMessage}
                onChange={(e) =>
                  setSettings({ ...settings, loserMessage: e.target.value })
                }
              />
              <span className="subtle">
                Tip: first line only. The system appends dynamic details (chosen
                box, box results, bet id, and dial code).
              </span>
            </div>

            <div className="input-row">
              <label>Send Winner SMS</label>
              <select
                value={settings.sendWinnerMessages ? "yes" : "no"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    sendWinnerMessages: e.target.value === "yes",
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              <span className="subtle">
                Tip: enables/disables SMS notifications for winners only.
              </span>
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

          {/* Manual B2C Test */}
          <div className="card demo-card">
            <h3>Test B2C (Manual Payout)</h3>
            <p className="subtle">
              Sends a manual B2C payout using your configured M-Pesa B2C env
              variables. Use a small amount and a test number.
            </p>

            {testB2cError && (
              <p className="subtle" style={{ color: "red" }}>
                {testB2cError}
              </p>
            )}

            <div className="input-row">
              <label>Phone Number</label>
              <input
                type="text"
                placeholder="2547XXXXXXXX"
                value={testB2cPhone}
                onChange={(e) => setTestB2cPhone(e.target.value)}
              />
              <span className="subtle">
                Tip: use 2547xxxxxxxx format (or 07xxxxxxxx; system normalizes).
              </span>
            </div>

            <div className="input-row">
              <label>Amount (KES)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={testB2cAmount}
                onChange={(e) => setTestB2cAmount(Number(e.target.value))}
              />
              <span className="subtle">
                Tip: keep it small during testing. The backend caps test payouts
                at 20,000.
              </span>
            </div>

            <button
              onClick={testB2c}
              disabled={testB2cLoading}
              style={{
                backgroundColor: "#111827",
                color: "white",
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: testB2cLoading ? "not-allowed" : "pointer",
                opacity: testB2cLoading ? 0.7 : 1,
                marginTop: "12px",
              }}
            >
              {testB2cLoading ? "Sending..." : "SEND TEST B2C"}
            </button>

            {testB2cResult && (
              <pre
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.08)",
                  overflowX: "auto",
                }}
              >
                {testB2cResult}
              </pre>
            )}
          </div>

          {/* Manual Loss SMS Test */}
          <div className="card demo-card">
            <h3>Test Loss SMS (Manual)</h3>
            <p className="subtle">
              Sends a real loss SMS using your configured SMS gateway. This helps you
              confirm delivery and see the exact player message (prefix + dynamic box results).
            </p>
            <p className="subtle" style={{ color: "#b45309" }}>
              Tip: this will spend SMS credits if your provider is live.
            </p>

            {testLossError && (
              <p className="subtle" style={{ color: "red" }}>
                {testLossError}
              </p>
            )}

            <div className="input-row">
              <label>Phone Number</label>
              <input
                type="text"
                placeholder="2547XXXXXXXX"
                value={testLossPhone}
                onChange={(e) => setTestLossPhone(e.target.value)}
              />
              <span className="subtle">
                Tip: use 2547xxxxxxxx format (or 07xxxxxxxx; system normalizes).
              </span>
            </div>

            <div className="input-row">
              <label>Selected Box</label>
              <input
                type="number"
                min="1"
                max="5"
                step="1"
                value={testLossBox}
                onChange={(e) => setTestLossBox(Number(e.target.value))}
              />
              <span className="subtle">
                Tip: we generate randomized box results but force this box to lose.
              </span>
            </div>

            <button
              onClick={testLossSms}
              disabled={testLossLoading}
              style={{
                backgroundColor: "#111827",
                color: "white",
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: testLossLoading ? "not-allowed" : "pointer",
                opacity: testLossLoading ? 0.7 : 1,
                marginTop: "12px",
              }}
            >
              {testLossLoading ? "Sending..." : "SEND TEST LOSS SMS"}
            </button>

            {testLossResult && (
              <pre
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.08)",
                  overflowX: "auto",
                }}
              >
                {testLossResult}
              </pre>
            )}
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
