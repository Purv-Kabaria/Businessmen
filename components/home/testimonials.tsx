"use client";
import { motion } from "framer-motion";
import { MessageSquare, Star } from "lucide-react";
import Image from "next/image";
import { TESTIMONIALS_CONTENT } from "@/constants/home/testimonials-constants";

export function Testimonials() {
  const testimonials = TESTIMONIALS_CONTENT.items;
  const communityAvatars = TESTIMONIALS_CONTENT.communityAvatars;

  return (
    <section
      className="py-20 px-4 bg-secondary font-sans"
      id={TESTIMONIALS_CONTENT.id}>
      <div className="container mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}>
          <span className="text-primary font-medium mb-2 inline-block font-sans">
            {TESTIMONIALS_CONTENT.eyebrow}
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground mb-4">
            {TESTIMONIALS_CONTENT.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-sans">
            {TESTIMONIALS_CONTENT.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </div>

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}>
          <div className="inline-flex items-center justify-center">
            <div className="flex -space-x-2 mr-4">
              {communityAvatars.map((avatarUrl, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-background overflow-hidden shadow-md">
                  <Image
                    src={avatarUrl}
                    alt={`Practitioner ${i + 1}`}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-muted-foreground font-sans">
              Used by{" "}
              <span className="font-semibold text-foreground">1000+</span>{" "}
              placeholders
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: {
    content: string;
    author: string;
    role: string;
    avatar: string;
    rating: number;
  };
  index: number;
}) {
  return (
    <motion.div
      className="bg-card rounded-xl border border-border p-6 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col h-full font-sans"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}>
      <div className="mb-4">
        <div className="flex items-center mb-4">
          <MessageSquare className="h-5 w-5 text-primary mr-2" />
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < testimonial.rating
                    ? "text-chart-1 fill-chart-1"
                    : "text-muted"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="text-muted-foreground font-medium italic mb-6 font-sans">
          &quot; {testimonial.content} &quot;
        </p>
      </div>
      <div className="mt-auto flex items-center">
        <div className="relative w-10 h-10 rounded-full overflow-hidden mr-3 shrink-0 border-2 border-primary/10">
          <Image
            src={testimonial.avatar}
            alt={testimonial.author}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
        <div>
          <h4 className="font-serif font-medium text-foreground">
            {testimonial.author}
          </h4>
          <p className="text-primary text-sm font-sans">{testimonial.role}</p>
        </div>
      </div>
    </motion.div>
  );
}
