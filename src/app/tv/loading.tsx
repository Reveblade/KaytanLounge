import { LoadingScreen } from "@/components/chrome/loading-screen";
import { getDictionary } from "@/lib/i18n/server";

export default async function Loading() {
  const { t } = await getDictionary();
  return <LoadingScreen label={t.common.loading} immediate />;
}
