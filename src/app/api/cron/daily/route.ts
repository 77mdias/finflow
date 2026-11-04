import { runDailyJob } from "@/modules/jobs";

import { cronRoute } from "../jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = cronRoute(runDailyJob);
