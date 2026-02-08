"use client";

import { useEffect } from "react";
import api from "../lib/api";

export default function SeedData() {
  if (process.env.NEXT_PUBLIC_MOCK_DATA !== "true") {
    return null;
  }

  useEffect(() => {
    const seed = async () => {
      try {
        await api.post("/admin/seed");
      } catch {
        // Ignore seed failures to avoid blocking UI.
      }
    };
    seed();
    const timer = setInterval(() => {
      api.post("/admin/simulate-payments").catch(() => {
        // Ignore simulate failures to keep UI responsive.
      });
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return null;
}
