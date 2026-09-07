/**
 * Notifications Module - Types & Contracts
 * Multi-channel notifications (in-app, SMS, push alerts)
 */

export interface INotificationsState {
  module: "notifications";
  status: "initialized";
  description: string;
}
