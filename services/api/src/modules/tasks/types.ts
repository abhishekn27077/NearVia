/**
 * Tasks Module - Types & Contracts
 * Micro-tasks and short-duration work assignment definitions
 */

export interface ITasksState {
  module: "tasks";
  status: "initialized";
  description: string;
}
