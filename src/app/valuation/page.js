import AppShell from "@/components/AppShell";
import ValuationTool from "@/components/valuation/ValuationTool";

export const metadata = {
  title: "Property Valuation | Estovia",
  description:
    "Estimate the advertised asking price of a home in Delhi NCR from a model trained on real public listings, with its measured error shown alongside the result.",
};

export default function ValuationPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Property valuation</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            An estimate of the advertised asking price, based only on real public
            listing data from Delhi NCR. The model&apos;s own measured error on cities it
            had never seen is shown with the result, so you can judge the number rather
            than take it on faith.
          </p>
        </header>
        <ValuationTool requestContext="standalone_estimate" />
      </div>
    </AppShell>
  );
}
