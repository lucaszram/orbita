import { cronJobs } from "convex/server";
const crons = cronJobs();

// Las alertas y resúmenes del portafolio se programan únicamente en core-control.

export default crons;
