import { ConfirmEmailChange } from "./ConfirmEmailChange";

export const metadata = { title: "Xác nhận email mới" };

/** Email change confirmation. A button (POST) confirms, so link scanners cannot use the token up. */
export default async function ConfirmEmailChangePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmEmailChange token={typeof token === "string" ? token : ""} />;
}
