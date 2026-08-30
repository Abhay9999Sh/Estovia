import AppShell from "@/components/AppShell";
import Hero from "@/components/hero/Hero";
import TrustSection from "@/components/home/TrustSection";
import RolesSection from "@/components/home/RolesSection";
import HowItWorks from "@/components/home/HowItWorks";
import FeaturedLand from "@/components/home/FeaturedLand";
import CTASection from "@/components/home/CTASection";

export default function Home() {
  return (
    <AppShell>
      <Hero />
      <TrustSection />
      <RolesSection />
      <HowItWorks />
      <FeaturedLand />
      <CTASection />
    </AppShell>
  );
}
