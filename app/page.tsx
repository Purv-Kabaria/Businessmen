"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Hero } from "@/components/home/hero";
import { CTA } from "@/components/home/cta";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Features } from "@/components/home/features";
import { Testimonials } from "@/components/home/testimonials";
import { FAQ } from "@/components/home/faq";

export default function Home() {
  return (
    <AnimatePresence mode="sync">
      <Navbar />
        <motion.main
          key="content"
          className="min-h-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}>
          <Hero />
          <Features />
          <Testimonials />
          <CTA />
          <FAQ />
          <Footer />
        </motion.main>
    </AnimatePresence>
  );
}
