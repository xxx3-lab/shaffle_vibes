"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const NAV = [
  { href: "/", label: "Дашборд" },
  { href: "/studio", label: "Студия" },
  { href: "/pins", label: "Пины" },
  { href: "/sources", label: "Источники" },
  { href: "/history", label: "История" },
  { href: "/settings", label: "Настройки" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
      className="sticky top-0 z-30 border-b-2 border-ink bg-paper/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="group flex items-center gap-2">
          <span className="font-display text-xl font-black uppercase tracking-tight md:text-2xl">
            Штатив
          </span>
          <motion.span
            className="text-accent"
            animate={{ rotate: [0, 90, 180, 270, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            ✳
          </motion.span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto md:gap-2">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors md:px-4 ${
                  active ? "text-paper" : "text-ink/70 hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </motion.header>
  );
}
