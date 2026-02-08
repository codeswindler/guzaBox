"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../lib/api";

const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1458950973673-6c201fb15b2f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
];

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"request" | "verify">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [fade, setFade] = useState(false);

  const images = useMemo(() => IMAGE_POOL, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setActiveIndex(nextIndex);
        setNextIndex((nextIndex + 1) % images.length);
        setFade(false);
      }, 1600);
    }, 12000);
    return () => clearInterval(interval);
  }, [images.length, nextIndex]);

  const requestOtp = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/auth/request-otp", {
        phone: phone.trim(),
        email: email.trim() || undefined,
      });
      setStage("verify");
      setMessage("OTP sent. Enter the code from your SMS.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", {
        phone: phone.trim(),
        code: code.trim(),
      });
      const token = res.data?.token;
      if (token) {
        localStorage.setItem("jazabox_token", token);
        router.replace("/");
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-hero">
      <div
        className="login-bg"
        style={{ backgroundImage: `url(${images[activeIndex]})` }}
      />
      <div
        className={`login-bg login-bg-next ${fade ? "is-visible" : ""}`}
        style={{ backgroundImage: `url(${images[nextIndex]})` }}
      />
      <div className="login-overlay" />
      <div className="login-card">
        <div className="login-header">
          <span className="brand-mark">JZ</span>
          <div>
            <h1>JazaBox Admin</h1>
            <p>Secure access for live operations.</p>
          </div>
        </div>

        <div className="login-body">
          <label>Admin Phone</label>
          <input
            type="tel"
            placeholder="2547xxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
          <label>Email (optional)</label>
          <input
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || stage === "verify"}
          />

          {stage === "verify" && (
            <>
              <label>OTP Code</label>
              <input
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
              />
            </>
          )}

          {message && <p className="subtle">{message}</p>}
          {error && <p className="subtle error-text">{error}</p>}

          <div className="login-actions">
            {stage === "request" ? (
              <button onClick={requestOtp} disabled={loading || !phone.trim()}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            ) : (
              <>
                <button
                  onClick={verifyOtp}
                  disabled={loading || !code.trim()}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setStage("request");
                    setCode("");
                    setMessage("");
                  }}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
