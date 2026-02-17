"use client";
import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import { useEffect } from "react";
import { footerConfig } from "@/constants/layout/footer-constants";
import { useAuthStore } from "@/store/useAuthStore";

export function Footer() {
  const { companyName, tagline, socialLinks, sections, contactInfo, legal } =
    footerConfig;
  const { user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const canShowStallField =
    !user ||
    (user.role !== "USER" && (user.role === "MODERATOR" || user.role === "ADMIN"));

  const getLinkHref = (href: string) => {
    if ((href === "/stall" || href === "/field") && !user)
      return `/login?redirect=${encodeURIComponent(href)}`;
    return href;
  };

  return (
    <footer className="bg-card text-card-foreground relative overflow-hidden border-t">
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center mb-4 font-serif text-xl">
              <span className="text-foreground font-semibold">
                {companyName.primary}
              </span>
              <span className="text-primary font-semibold">
                {companyName.secondary}
              </span>
            </div>
            <p className="text-muted-foreground mb-6 text-sm font-sans">
              {tagline}
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <SocialLink
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}>
                  <social.icon className="h-5 w-5" />
                </SocialLink>
              ))}
            </div>
          </div>

          {/* Dynamic Sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="font-serif font-semibold text-lg mb-4 text-foreground">
                {section.title}
              </h3>
              {section.links
                .filter(
                  (link) =>
                    (link.href !== "/stall" && link.href !== "/field") ||
                    canShowStallField
                )
                .map((link) => (
                  <FooterLink key={link.label} href={getLinkHref(link.href)}>
                    {link.label}
                  </FooterLink>
                ))}
            </div>
          ))}

          {/* Contact Section */}
          <div>
<h3 className="font-serif font-semibold text-lg mb-4 text-foreground">
            Contact Us
          </h3>
            <div className="flex items-start mb-3">
              <MapPin className="h-5 w-5 mr-3 text-primary shrink-0 mt-1" />
              <span className="text-muted-foreground text-sm font-sans">
                {contactInfo.address.line1}
                <br />
                {contactInfo.address.line2}
                {contactInfo.address.line3 && (
                  <>
                    <br />
                    {contactInfo.address.line3}
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center mb-3">
              <Mail className="h-5 w-5 mr-3 text-primary shrink-0" />
              <span className="text-muted-foreground text-sm font-sans">
                {contactInfo.email}
              </span>
            </div>
            <div className="flex items-center mb-3">
              <Phone className="h-5 w-5 mr-3 text-primary shrink-0" />
              <span className="text-muted-foreground text-sm font-sans">
                {contactInfo.phone}
              </span>
            </div>
          </div>
        </div>

        {/* Legal Section */}
        <div className="border-t border-border pt-8 text-center">
          <p className="text-muted-foreground text-sm font-sans">
            &copy; {new Date().getFullYear()} {legal.copyrightText}
          </p>
          <div className="flex justify-center mt-4 space-x-6 text-sm text-muted-foreground font-sans">
            {legal.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      href={href}
      className="bg-foreground/10 p-2 rounded-full text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
      {...props}>
      {children}
    </Link>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <Link
        href={href}
        className="text-muted-foreground hover:text-primary transition-colors text-sm font-sans">
        {children}
      </Link>
    </div>
  );
}
