/**
 * Auth Module - Types & Contracts
 * Authentication, OTP verification, session management & Supabase Auth integration
 */

export interface IAuthState {
  module: "auth";
  status: "initialized";
  description: string;
}
