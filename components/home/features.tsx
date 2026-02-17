"use client";
import { motion } from "framer-motion";
import { FEATURES_CONTENT } from "@/constants/home/features-constants";

export function Features() {
  const features = FEATURES_CONTENT.items.map((item) => {
    const Icon = item.icon;
    return {
      icon: <Icon />,
      title: item.title,
      description: item.description,
    };
  });

  return (
    <section className="py-20 px-4 bg-background font-sans" id={FEATURES_CONTENT.id}>
      <div className="container mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}>
          <span className="text-primary font-medium mb-2 inline-block font-sans">
            {FEATURES_CONTENT.eyebrow}
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground mb-4">
            {FEATURES_CONTENT.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-sans">
            {FEATURES_CONTENT.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      className="bg-card rounded-xl border border-border p-6 shadow-lg hover:shadow-xl transition-all duration-300 group"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}>
      <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
        {icon}
      </div>
      <h3 className="font-serif text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground font-sans">{description}</p>
    </motion.div>
  );
}