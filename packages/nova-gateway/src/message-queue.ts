// ─── In-Memory Priority Message Queue ───
// Buffers incoming gateway messages with priority ordering

import type { GatewayMessage } from "./index.js";

export interface QueuedMessage {
  id: string;
  channel: string;
  message: GatewayMessage;
  priority: number;
  enqueuedAt: Date;
  retries: number;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];

  /**
   * Add a message to the queue, maintaining priority order.
   * Lower priority number = higher priority (dequeued first).
   * Within the same priority, messages are ordered FIFO (insertion order).
   */
  enqueue(message: QueuedMessage): void {
    // Binary insert to maintain sorted order by priority (stable)
    let lo = 0;
    let hi = this.queue.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const midMsg = this.queue[mid];
      if (midMsg && midMsg.priority <= message.priority) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    this.queue.splice(lo, 0, message);
  }

  /**
   * Remove and return the highest-priority message (lowest priority number).
   * Returns undefined if the queue is empty.
   */
  dequeue(): QueuedMessage | undefined {
    return this.queue.shift();
  }

  /**
   * Return the highest-priority message without removing it.
   * Returns undefined if the queue is empty.
   */
  peek(): QueuedMessage | undefined {
    return this.queue[0];
  }

  /**
   * Get the current number of messages in the queue.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Remove all messages from the queue.
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Remove and return all messages in priority order.
   */
  drain(): QueuedMessage[] {
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }
}
