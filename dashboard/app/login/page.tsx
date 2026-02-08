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
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [fade, setFade] = useState(false);

  const images = useMemo(() => IMAGE_POOL, []);
  const transitionMs = 3800;
  const intervalMs = 5000;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("jazabox_token");
      if (token) {
        router.replace("/");
      }
    }
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setActiveIndex(nextIndex);
        setNextIndex((nextIndex + 1) % images.length);
        setFade(false);
      }, transitionMs);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [images.length, nextIndex, transitionMs, intervalMs]);

  const login = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        identifier: identifier.trim(),
        email: email.trim() || undefined,
        password: password.trim(),
      });
      const token = res.data?.token;
      if (token) {
        localStorage.setItem("jazabox_token", token);
        router.replace("/");
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Login failed.");
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
          <label>Phone or Email</label>
          <input
            type="text"
            placeholder="2547xxxxxxxx or admin@example.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
          />
          <label>Email (optional)</label>
          <input
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {message && <p className="subtle">{message}</p>}
          {error && <p className="subtle error-text">{error}</p>}

          <div className="login-actions">
            <button
              onClick={login}
              disabled={loading || !identifier.trim() || !password.trim()}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
