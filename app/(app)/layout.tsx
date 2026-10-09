import { BottomNav } from "@/components/layout/bottom-nav";
import { TourGate } from "@/components/onboarding/welcome-tour";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="relative mx-auto w-full max-w-lg flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
      <TourGate />
    </>
  );
}
