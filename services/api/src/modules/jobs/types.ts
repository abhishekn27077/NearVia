/**
 * Jobs Module - Types & Contracts
 * Job postings, requirement specifications, and lifecycle management
 */

export interface IJobsState {
  module: "jobs";
  status: "initialized";
  description: string;
}
