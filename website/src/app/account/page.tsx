import type { Metadata } from "next";
import { SiteHeader } from "@/components/chrome/site-header";
import { AccountView } from "@/components/account/account-view";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.account.title };
}

export default function AccountPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[1100px] px-5 pb-32 pt-28 sm:px-8">
        <AccountView />
      </main>
    </>
  );
}
