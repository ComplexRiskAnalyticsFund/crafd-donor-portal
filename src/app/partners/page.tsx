// Server Component - optimized for Vercel deployment
// Data fetching example for when ready to implement viz:
// import { getPartners, getPartnerStats } from "@/lib/data/partners";
//
// const partners = await getPartners(); // Fetches during build/request
// const stats = getPartnerStats(partners);

export default function PartnersPage() {
  return (
    <iframe
      src="/crafd-partners.pdf"
      className="fixed inset-0 h-full w-full border-none"
      title="CRAF'd Partners"
    />
  );
}
