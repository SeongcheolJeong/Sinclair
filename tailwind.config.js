/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Sora",
          "Noto Sans KR",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          950: "#030712",
          900: "#080f1f",
          850: "#0b1126",
          800: "#111826",
          700: "#1a2332",
        },
        camera: "#00e5ff",
        radar: "#2ef5a9",
        lidar: "#a568ff",
        fusion: "#f2c85b",
      },
      boxShadow: {
        glow: "0 0 30px rgba(0, 229, 255, 0.18)",
        card: "0 18px 60px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        "scan-grid":
          "linear-gradient(rgba(0,229,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.07) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
