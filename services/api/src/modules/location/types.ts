/**
 * Location Module - Types & Contracts
 * Hyperlocal spatial queries, PostGIS integration, and proximity calculations
 */

export interface ILocationState {
  module: "location";
  status: "initialized";
  description: string;
}
