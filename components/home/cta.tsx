"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ctaConfig } from "@/constants/home/cta-constants";

export function CTA() {
  const { badge, heading, features, buttons, dashboard } = ctaConfig;

  return (
    <section className="py-24 px-4 relative overflow-hidden bg-linear-to-b from-primary/50 to-primary/90 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}>
            <div className="bg-accent text-accent-foreground font-semibold px-4 py-1.5 rounded-full inline-block mb-4 text-sm font-sans">
              {badge.text}
            </div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 text-primary-foreground leading-tight">
              {heading.title}
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg font-sans">
              {heading.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-6 mb-10">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start bg-primary-foreground/10 p-4 rounded-xl backdrop-blur-sm">
                  <div className="bg-accent p-2.5 rounded-full mr-4 shadow-lg">
                    <feature.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-serif font-medium mb-1 text-primary-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-primary-foreground/70 text-sm font-sans">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {buttons.map((button, index) => {
                const isPrimary = button.variant === "primary";
                return (
                  <Button
                    key={index}
                    size="lg"
                    variant={isPrimary ? "default" : "outline"}
                    className={
                      isPrimary
                        ? "bg-background hover:bg-background/90 text-foreground font-medium shadow-lg font-sans"
                        : "bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 font-medium backdrop-blur-sm font-sans"
                    }
                    asChild>
                    <Link href={button.href}>
                      {isPrimary ? (
                        <span className="flex items-center">
                          {button.text}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </span>
                      ) : (
                        button.text
                      )}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}>
            <div className="relative bg-background/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-md mx-auto border border-border">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-serif font-semibold text-foreground">
                  {dashboard.title} • {dashboard.contactName}
                </h4>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </div>

              <div className="space-y-4 h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-accent/50 scrollbar-track-transparent pr-2">
                {dashboard.items.map((item, index) => (
                  <DashboardItemComponent
                    key={index}
                    icon={item.icon}
                    title={item.title}
                    time={item.time}
                    content={item.content}
                    delay={0.1 * (index + 1)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DashboardItemComponent({
  icon: Icon,
  title,
  time,
  content,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  time: string;
  content: string;
  delay: number;
}) {
  return (
    <motion.div
      className="bg-card p-4 rounded-lg border border-border shadow-sm flex space-x-3 font-sans"
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}>
      <div className="w-8 h-8 shrink-0 mt-1">
        <Icon className="text-primary" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <span className="font-serif font-medium text-sm text-foreground mr-2">
              {title}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-sans">
            {time}
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-sans">{content}</p>
      </div>
    </motion.div>
  );
}
