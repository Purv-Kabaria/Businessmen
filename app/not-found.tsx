"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.25,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const numberVariants = {
  hidden: { opacity: 0, y: -40, rotateX: -90 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.8,
      ease: "easeOut",
      type: "spring",
      stiffness: 150,
      damping: 20,
    },
  }),
};

export default function NotFound() {
  const errorCode = "404".split("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center font-sans">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-lg space-y-8"
      >
        <motion.div
          variants={itemVariants as Variants}
          className="flex justify-center"
          aria-label="Error 404"
        >
          {errorCode.map((char, index) => (
            <motion.span
              key={index}
              custom={index}
              variants={numberVariants as Variants}
              className="text-8xl font-bold font-mono text-primary md:text-9xl"
            >
              {char}
            </motion.span>
          ))}
        </motion.div>

        <motion.div variants={itemVariants as Variants} className="space-y-3">
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Page Not Found
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>
        </motion.div>

        <motion.div variants={itemVariants as Variants}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Button
              asChild
              size="lg"
              className="mt-4 bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground shadow-lg transition-shadow duration-300 hover:shadow-xl"
            >
              <Link href="/">
                <Undo2 className="mr-3 h-6 w-6" />
                Go Back Home
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}