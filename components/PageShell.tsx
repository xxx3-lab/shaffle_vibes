"use client";

import { motion } from "framer-motion";

// Обёртка страницы: появление + крупный «постерный» заголовок.
export function PageShell({
  title,
  subtitle,
  accentWord,
  children,
}: {
  title: string;
  subtitle: string;
  accentWord?: string;
  children: React.ReactNode;
}) {
  const parts = accentWord ? title.split(accentWord) : [title];

  return (
    <motion.main
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5 }}
      >
        <h1 className="font-display text-3xl font-black uppercase leading-[1.05] tracking-tight md:text-6xl">
          {accentWord && parts.length > 1 ? (
            <>
              {parts[0]}
              <span className="text-accent">{accentWord}</span>
              {parts[1]}
            </>
          ) : (
            title
          )}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink/60 md:text-base">{subtitle}</p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
        }}
        className="mt-10"
      >
        {children}
      </motion.div>
    </motion.main>
  );
}

// Стандартный ребёнок PageShell — всплывает снизу.
export function Rise({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
