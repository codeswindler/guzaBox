"use client";

import { useEffect } from "react";

export default function CardTone() {
  useEffect(() => {
    const hue = Math.floor(Math.random() * 200) + 120;
    document.documentElement.style.setProperty("--card-hue", String(hue));
    document.documentElement.style.setProperty("--card-hue-strong", String(hue + 10));
  }, []);

  return null;
}
