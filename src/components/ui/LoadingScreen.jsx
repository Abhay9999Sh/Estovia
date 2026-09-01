import Spinner from "@/components/ui/Spinner";

export default function LoadingScreen({ label = "Loading…", className = "" }) {
  return (
    <div
      className={`flex min-h-[50vh] w-full items-center justify-center py-16 ${className}`}
    >
      <Spinner label={label} />
    </div>
  );
}