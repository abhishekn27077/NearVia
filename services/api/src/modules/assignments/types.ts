/**
 * Assignments Module - Types & Contracts
 * Active job assignments, arrival confirmations, and task execution lifecycle
 */

export interface IAssignmentsState {
  module: "assignments";
  status: "initialized";
  description: string;
}
