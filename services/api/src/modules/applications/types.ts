/**
 * Applications Module - Types & Contracts
 * Worker job applications, invitations, and status tracking
 */

export interface IApplicationsState {
  module: "applications";
  status: "initialized";
  description: string;
}
