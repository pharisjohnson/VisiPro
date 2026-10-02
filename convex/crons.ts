import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("auto-checkout visitors", { hours: 1 }, internal.autoCheckout.sweepVisitors, {});
crons.interval("auto-checkout employees", { hours: 1 }, internal.autoCheckout.sweepEmployees, {});
export default crons;
