"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { FAQ_CONTENT } from "@/constants/home/faq-constants";

export function FAQ() {
  const faqs = FAQ_CONTENT.items;

  return (
    <section className="py-20 px-4 bg-background font-sans" id={FAQ_CONTENT.id}>
      <div className="container mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}>
          <span className="text-primary font-medium mb-2 inline-block font-sans">
            {FAQ_CONTENT.eyebrow}
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground mb-4">
            {FAQ_CONTENT.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-sans">
            {FAQ_CONTENT.description}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}>
                <AccordionItem
                  value={`item-${index}`}
                  className="border border-border rounded-xl overflow-hidden bg-card shadow-sm font-sans">
                  <AccordionTrigger className="px-6 py-4 hover:bg-primary/5 text-left font-serif font-medium text-foreground data-[state=open]:text-primary transition-all">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 pt-2 text-muted-foreground font-sans">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
