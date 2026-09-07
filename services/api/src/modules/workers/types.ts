/**
 * Workers Module - Types & Contracts
 * Worker skill profiles, service radius, hourly rates, and work history
 */

export interface IWorkersState {
  module: "workers";
  status: "initialized";
  description: string;
}
