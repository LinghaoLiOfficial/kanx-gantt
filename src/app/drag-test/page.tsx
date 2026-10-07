import { notFound } from "next/navigation";
import DragTest from "./test-chart";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DragTest />;
}
