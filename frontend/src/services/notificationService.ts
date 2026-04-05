/**
 * Notification Service
 * Gestisce push notifications e notification center.
 */
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  icon: string | null;
  link: string | null;
  is_read: boolean;
  is_pushed: boolean;
  created_at: string;
}

// ─── Push Notification Helpers ───────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

const notificationService = {
  /** Register service worker and subscribe to push */
  async registerServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Notifications] Service worker registered');

      // Get VAPID key
      const { data: vapidData } = await api.get('/notifications/vapid-public-key');
      if (!vapidData.public_key) {
        console.warn('No VAPID key configured');
        return false;
      }

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidData.public_key);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to backend
      const subJson = subscription.toJSON();
      await api.post('/notifications/push/subscribe', {
        endpoint: subJson.endpoint,
        p256dh_key: subJson.keys?.p256dh || '',
        auth_key: subJson.keys?.auth || '',
        user_agent: navigator.userAgent,
      });

      console.log('[Notifications] Push subscription registered');
      return true;
    } catch (err) {
      console.error('[Notifications] Registration failed:', err);
      return false;
    }
  },

  /** Unsubscribe from push */
  async unsubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api.delete('/notifications/push/unsubscribe', {
        params: { endpoint: subscription.endpoint },
      });
      await subscription.unsubscribe();
    }
  },

  /** Check if push is currently subscribed */
  async isSubscribed(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  },

  /** Check notification permission */
  getPermissionState(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  /** Request notification permission */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    return Notification.requestPermission();
  },

  // ─── Notification Center API ─────────────────────────────────────────────

  async list(unreadOnly: boolean = false, limit: number = 50): Promise<NotificationItem[]> {
    const { data } = await api.get('/notifications', {
      params: { unread_only: unreadOnly, limit },
    });
    return data;
  },

  async getUnreadCount(): Promise<number> {
    const { data } = await api.get('/notifications/unread-count');
    return data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
