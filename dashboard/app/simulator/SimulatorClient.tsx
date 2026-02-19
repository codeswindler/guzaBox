"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";

type ToastItem = { id: string; message: string };

export default function SimulatorClient() {
  const menuText = `Kwachua Box
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
  const dialText = "*123#";
  const [inputText, setInputText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [screenText, setScreenText] = useState(menuText);
  const [mode, setMode] = useState<"dial" | "session">("session");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loserPrefix, setLoserPrefix] = useState("Almost won. Try again.");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Auto-start the menu session
    startSession(dialText);
    
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!["1", "2", "3", "4", "5", "6"].includes(choice)) {
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
    const boxCount = 6;

    // Randomize total losing boxes: 2 or 3 (inclusive of selected box).
    const loserTarget = randomInt(2, 3);
    const loserBoxes = new Set<number>([selectedBox]);

    const isAdjacentToAnyLoser = (box: number) => {
      for (const loser of loserBoxes) {
        if (Math.abs(loser - box) <= 1) return true;
      }
      return false;
    };

    const candidates = Array.from({ length: boxCount }, (_, idx) => idx + 1).filter(
      (b) => b !== selectedBox
    );
    const shuffled = candidates.sort(() => Math.random() - 0.5);

    for (const b of shuffled) {
      if (loserBoxes.size >= loserTarget) break;
      if (isAdjacentToAnyLoser(b)) continue;
      loserBoxes.add(b);
    }

    if (loserBoxes.size < loserTarget) {
      for (const b of shuffled) {
        if (loserBoxes.size >= loserTarget) break;
        loserBoxes.add(b);
      }
    }

    for (let i = 1; i <= boxCount; i++) {
      if (loserBoxes.has(i)) {
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
    // No longer needed - auto-starts
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
    setInputText("");
    setScreenText(menuText);
    setHistory([]);
    setShowReplyInput(false);
    setIsComplete(false);
    // Restart session
    startSession(dialText);
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
    // No longer needed - no dial mode
  };

  const handleDelete = () => {
    // No longer needed - no dial mode
  };

  return (
    <div>
      <h2 className="page-title">USSD Simulator</h2>
      <p className="subtle">Dial and test the menu flow with a live handset UI.</p>
      <div className="simulator-header">
        <div className="simulator-brand">
          <div className="simulator-icon">KB</div>
          <div>
            <div className="simulator-heading">USSD Simulator</div>
            <div className="simulator-subheading">KWACHUA BOX - PROTOTYPE v1.0</div>
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
                Menu starts automatically (USSD code: <span className="pill">{dialText}</span>)
              </li>
              <li>Navigate using keypad (Option 1 - 6)</li>
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
            <div className="phone-body">
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
                        Restart
                      </button>
                      <button className="ussd-send" onClick={handleReply}>
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
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
