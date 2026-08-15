import { recordInteraction } from "@/lib/record-interaction";

export async function POST(request: Request) {
  return recordInteraction(request, "record_listing_view");
}
