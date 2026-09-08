"use client";

import { motion } from "framer-motion";

// Плавающие градиентные блобы на фоне — «магия» сайта.
export function FloatingMagic() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="blob h-[480px] w-[480px] bg-[radial-gradient(circle,#b9a5ff_0%,transparent_65%)]"
        style={{ top: "-140px", right: "-120px" }}
        animate={{ x: [0, -60, 30, 0], y: [0, 50, -20, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="blob h-[420px] w-[420px] bg-[radial-gradient(circle,#e4fb8f_0%,transparent_65%)]"
        style={{ bottom: "-160px", left: "-140px" }}
        animate={{ x: [0, 70, -20, 0], y: [0, -40, 20, 0], scale: [1, 0.9, 1.12, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="blob h-[260px] w-[260px] bg-[radial-gradient(circle,#8fe6ff_0%,transparent_65%)]"
        style={{ top: "40%", left: "55%" }}
        animate={{ x: [0, -80, 40, 0], y: [0, 60, -50, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
