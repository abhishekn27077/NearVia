/**
 * Matching Module - Types & Contracts
 * Multi-factor explainable ranking engine (Skill, Distance, Availability, Rating)
 */

export interface IMatchingState {
  module: "matching";
  status: "initialized";
  description: string;
}
