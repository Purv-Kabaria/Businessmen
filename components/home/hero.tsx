"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { HERO_CONTENT } from "@/constants/home/hero-constants";
import { Background } from "@/components/home/background";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden font-sans pt-24 md:pt-0 bg-linear-to-br from-background to-muted">
      <Background />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 py-16 md:py-0">
        <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground lg:mt-24 mb-6 sm:mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}>
            <span className="font-serif font-medium">
              {HERO_CONTENT.headline.primary}
            </span>
            <span className="block font-sans font-bold text-primary mt-1 md:mt-2">
              {HERO_CONTENT.headline.secondary}
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-foreground/80 mb-10 max-w-2xl font-sans"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}>
            {HERO_CONTENT.description}
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 mb-16 w-full justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-base py-6 px-8 font-sans font-semibold rounded-md"
              asChild>
              <Link href={HERO_CONTENT.ctas.primary.href}>
                {HERO_CONTENT.ctas.primary.label}
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border text-foreground/80 bg-transparent hover:bg-secondary hover:text-foreground text-base py-6 px-8 font-sans font-semibold rounded-md"
              asChild>
              <Link href={HERO_CONTENT.ctas.secondary.href}>
                {HERO_CONTENT.ctas.secondary.label}
              </Link>
            </Button>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full max-w-4xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ staggerChildren: 0.1 }}>
            {HERO_CONTENT.highlights.map((h, i) => {
              const Icon = h.icon;
              return (
                <HighlightCard
                  key={i}
                  icon={<Icon className="h-8 w-8" />}
                  title={h.title}
                  description={h.description}
                />
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function HighlightCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      className="bg-card border border-border/70 rounded-xl p-5 flex flex-col items-center text-center transition-all duration-300 shadow-sm"
      variants={cardVariants}>
      <div className="p-3 bg-secondary rounded-full mb-4 text-primary">
        {icon}
      </div>
      <h3 className="font-serif text-3xl font-medium text-foreground mb-1">
        {title}
      </h3>
      <p className="text-foreground/70 text-sm font-sans">{description}</p>
    </motion.div>
  );
}
