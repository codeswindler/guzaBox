"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

type ToastItem = { id: string; message: string };

export default function SimulatorClient() {
  const menuText = `Lucky Box
Stake Between Ksh. 20 and 30
Chagua Box yako ya Ushindi
1. Box 1
2. Box 2
3. Box 3
4. Box 4
5. Box 5`;
  const sessionId = useMemo(
    () => `sim-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const [phoneNumber, setPhoneNumber] = useState("254700000000");
  const [dialText, setDialText] = useState("*519*63#");
  const [inputText, setInputText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [screenText, setScreenText] = useState(menuText);
  const [mode, setMode] = useState<"dial" | "session">("dial");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loserPrefix, setLoserPrefix] = useState("Almost won. Try again.");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Optional: pull the configured loss message prefix (requires admin JWT).
    // Simulator still works without auth/backend; this just enriches the toast text.
    api
      .get("/admin/instant-win/status")
      .then((res) => {
        const settings = (res.data &&
          typeof res.data === "object" &&
          (res.data as any).settings) as any;
        if (settings && typeof settings.loserMessage === "string") {
          setLoserPrefix(settings.loserMessage);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const pushToast = (message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    setToasts((prev) => [{ id, message }, ...prev].slice(0, 6));
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const randomInt = (min: number, max: number) =>
    Math.floor(min + Math.random() * (max - min + 1));

  const generateBetId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Z1o${result}`;
  };

  const buildLossSms = (args: {
    betId: string;
    selectedBox: number;
    boxResults: Record<number, number>;
  }) => {
    const lines = [
      loserPrefix,
      "",
      `You chose ${args.selectedBox}`,
      "",
      ...Object.entries(args.boxResults).map(
        ([box, value]) => `Box ${Number(box)}: ${value}`
      ),
      "",
      `Bet: ${args.betId}`,
      `Dial ${dialText} to win more.`,
    ];
    return lines.join("\n");
  };

  const startSession = (dial: string) => {
    const trimmed = dial.trim();
    // In production the backend tolerates a bunch of variants; for the simulator we accept any *...# dial.
    const ok = trimmed.includes("*") || trimmed.includes("#");
    const response = ok ? `CON ${menuText}` : `CON ${menuText}\nInvalid code. Try again.`;
    setHistory((prev) => [...prev, `> ${trimmed || "(dial)"}`, response]);
    setScreenText(response);
    setIsComplete(false);
    setMode("session");
  };

  const simulateSelection = (choiceRaw: string) => {
    const choice = choiceRaw.trim();
    if (!["1", "2", "3", "4", "5"].includes(choice)) {
      const response = `CON ${menuText}\nInvalid choice. Try again.`;
      setHistory((prev) => [...prev, `> ${choice}`, response]);
      setScreenText(response);
      return;
    }

    const selectedBox = Number(choice);
    const amount = randomInt(20, 30);
    const betId = generateBetId();

    // Loss-only simulation: does not create transactions or call STK.
    // Populate boxes with a mix of losing and enticing values; selected is always losing (0).
    // Ensure at least 1-2 *additional* losing boxes to make the SMS feel realistic.
    const boxResults: Record<number, number> = {};
    const otherBoxes = [1, 2, 3, 4, 5].filter((b) => b !== selectedBox);
    const extraLosingCount = randomInt(1, 2);
    const extraLosingBoxes = new Set<number>();
    while (extraLosingBoxes.size < extraLosingCount) {
      extraLosingBoxes.add(otherBoxes[randomInt(0, otherBoxes.length - 1)]);
    }

    for (let i = 1; i <= 5; i++) {
      if (i === selectedBox || extraLosingBoxes.has(i)) {
        boxResults[i] = 0;
      } else {
        boxResults[i] = [50, 100, 200, 500][randomInt(0, 3)];
      }
    }

    const ussdResponse = `END Payment received (simulated)\nAmount: Ksh ${amount}\nSelected: Box ${selectedBox}\nStatus: LOST\n\nDial ${dialText} to try again.`;
    setHistory((prev) => [...prev, `> ${choice}`, ussdResponse]);
    setScreenText(ussdResponse);
    setIsComplete(true);

    pushToast(`Incoming payment (simulated): Ksh ${amount} from ${phoneNumber}`);
    pushToast(`Loss SMS (simulated) to ${phoneNumber}:\n${buildLossSms({
      betId,
      selectedBox,
      boxResults,
    })}`);
  };

  const handleDial = async () => {
    startSession(dialText);
    setInputText("");
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (isComplete) {
      pushToast("Session ended. Tap Dismiss to start again.");
      setInputText("");
      setShowReplyInput(false);
      return;
    }
    simulateSelection(inputText.trim());
    setInputText("");
    setShowReplyInput(false);
  };

  const handleEnd = () => {
    setMode("dial");
    setDialText("*519*63#");
    setInputText("");
    setScreenText(menuText);
    setHistory([]);
    setShowReplyInput(false);
    setIsComplete(false);
  };

  const handleReply = () => {
    if (!showReplyInput) {
      setShowReplyInput(true);
      setTimeout(() => replyInputRef.current?.focus(), 50);
      return;
    }
    handleSend();
  };

  const handleDigitPress = (value: string) => {
    if (mode === "dial") {
      setDialText((prev) => `${prev}${value}`);
    }
  };

  const handleDelete = () => {
    setDialText((prev) => prev.slice(0, -1));
  };

  return (
    <div>
      <h2 className="page-title">USSD Simulator</h2>
      <p className="subtle">Dial and test the menu flow with a live handset UI.</p>
      <div className="simulator-header">
        <div className="simulator-brand">
          <div className="simulator-icon">LB</div>
          <div>
            <div className="simulator-heading">USSD Simulator</div>
            <div className="simulator-subheading">LUCKY BOX - PROTOTYPE v1.0</div>
          </div>
        </div>
        <div className="simulator-actions">
          <span className="simulator-code">{dialText}</span>
        </div>
      </div>
      <div className="simulator-layout">
        <div className="simulator-copy">
          <h3 className="simulator-title">
            Test your mobile lottery flows instantly.
          </h3>
          <p className="subtle">
            Experience the full USSD flow from box selection to payment.
            Updates in balance and win limits happen in real-time.
          </p>
          <div className="card how-to-card">
            <h4>How to test</h4>
            <ol className="how-to-list">
              <li>
                Dial <span className="pill">{dialText}</span> on the simulator
              </li>
              <li>Navigate using keypad (Option 1 - 5)</li>
              <li>After selection, payment + SMS are simulated locally</li>
              <li>Simulation does not write to transactions</li>
            </ol>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h4>Session log</h4>
            <div className="mono" style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
              {history.length === 0 ? "No messages yet." : history.join("\n")}
            </div>
          </div>
        </div>
        <div className="simulator-device">
          <div className="phone-device">
            <div className="phone-status">
              <span>9:41</span>
              <div className="status-icons">
                <span className="status-signal" />
                <span className="status-wifi" />
                <span className="status-battery">
                  <span className="status-battery-fill" />
                </span>
              </div>
            </div>
            <div className={`phone-body ${mode === "dial" ? "dialer-only" : ""}`}>
              {mode === "dial" ? (
                <div className="dialer-view">
                  <div className="dialer-keypad">
                    <div className="dialer-keypad-grid">
                      {[
                        ["1", ""],
                        ["2", "ABC"],
                        ["3", "DEF"],
                        ["4", "GHI"],
                        ["5", "JKL"],
                        ["6", "MNO"],
                        ["7", "PQRS"],
                        ["8", "TUV"],
                        ["9", "WXYZ"],
                      ].map(([digit, letters]) => (
                        <button
                          key={digit}
                          className="dialer-key-btn"
                          onClick={() => handleDigitPress(digit)}
                        >
                          <span className="dialer-digit">{digit}</span>
                          <span className="dialer-letters">{letters}</span>
                        </button>
                      ))}
                      <button
                        className="dialer-key-btn dialer-symbol"
                        onClick={() => handleDigitPress("*")}
                      >
                        <span className="dialer-symbol-text">*</span>
                      </button>
                      <button
                        className="dialer-key-btn"
                        onClick={() => handleDigitPress("0")}
                      >
                        <span className="brand-mark">LB</span>
                        <span className="dialer-letters">+</span>
                      </button>
                      <button
                        className="dialer-key-btn dialer-symbol"
                        onClick={() => handleDigitPress("#")}
                      >
                        <span className="dialer-symbol-text">#</span>
                      </button>
                    </div>
                    <div className="dialer-actions-row dialer-actions-center">
                      <button
                        className="dialer-call-btn"
                        onClick={handleDial}
                        aria-label="Call"
                      >
                        <svg
                          className="dialer-call-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.6-1.5a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ussd-modal">
                  <div className="ussd-card">
                    <div className="ussd-modal-body">
                      <p className="mono">
                        {screenText.replace(/^CON\\s+/, "").replace(/^END\\s+/, "")}
                      </p>
                    </div>
                    {showReplyInput && (
                      <div className="ussd-input-row">
                        <input
                          ref={replyInputRef}
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder=""
                        />
                      </div>
                    )}
                    <div className="ussd-actions ussd-actions-split">
                      <button className="ussd-cancel" onClick={handleEnd}>
                        Dismiss
                      </button>
                      <button className="ussd-send" onClick={handleReply}>
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="phone-home">
              <span />
            </div>
          </div>
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.slice(0, 4).map((toast) => (
            <div key={toast.id} className="toast" style={{ whiteSpace: "pre-wrap" }}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
