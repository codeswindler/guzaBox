"use client";

import { useMemo, useRef, useState } from "react";
import api from "../../lib/api";

export default function SimulatorClient() {
  const menuText = `Lucky Box
Stake Between Ksh. 20 and 30
Chagua Box yako ya Ushindi
1. Box 1
2. Box 2
3. Box 3
4. Box 4
5. Box 5
6. Box 6`;
  const sessionId = useMemo(
    () => `sim-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const [phoneNumber, setPhoneNumber] = useState("254700000000");
  const [dialText, setDialText] = useState("*123#");
  const [inputText, setInputText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [screenText, setScreenText] = useState(menuText);
  const [mode, setMode] = useState<"dial" | "session">("dial");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const send = async (text: string) => {
    const res = await api.post("/ussd/simulate", {
      sessionId,
      phoneNumber,
      text,
    });
    setHistory((prev) => [...prev, `> ${text || "(start)"}`, res.data.response]);
    setScreenText(res.data.response);
  };

  const handleDial = async () => {
    const isDefaultDial = dialText.trim() === "*123#";
    await send(isDefaultDial ? "" : dialText.trim());
    setMode("session");
    setInputText("");
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    await send(inputText.trim());
    setInputText("");
    setShowReplyInput(false);
  };

  const handleEnd = () => {
    setMode("dial");
    setDialText("*123#");
    setInputText("");
    setScreenText(menuText);
    setHistory([]);
    setShowReplyInput(false);
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
              <li>Navigate using keypad (Option 1 - 6)</li>
              <li>Watch the live data panel update automatically</li>
              <li>Toast notifications simulate incoming payments</li>
            </ol>
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
                      <p className="mono">{screenText}</p>
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
    </div>
  );
}
