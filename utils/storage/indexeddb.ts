// Strike Team Alpha - IndexedDB Implementation
// Replace localStorage usage with this high-capacity storage solution

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Conversation, Message } from '@/types/chat';
import pako from 'pako';

interface AmplifyDB extends DBSchema {
  conversations: {
    key: string;
    value: {
      id: string;
      name: string;
      model: any;
      prompt: string;
      temperature: number;
      folderId: string | null;
      messages: string[]; // Array of message IDs, not actual messages
      createdAt: number;
      updatedAt: number;
    };
  };
  messages: {
    key: string;
    value: {
      id: string;
      conversationId: string;
      role: string;
      content: string;
      data?: any;
      createdAt: number;
    };
    indexes: { 'by-conversation': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

class IndexedDBStorage {
  private db: IDBPDatabase<AmplifyDB> | null = null;
  private readonly DB_NAME = 'amplify-storage';
  private readonly DB_VERSION = 1;
  
  async init(): Promise<void> {
    if (this.db) return;
    
    this.db = await openDB<AmplifyDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Create conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' });
        }
        
        // Create messages store with index
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-conversation', 'conversationId');
        }
        
        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  
  // Conversation methods
  async saveConversation(conversation: Conversation): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(['conversations', 'messages'], 'readwrite');
    
    // Extract messages and save them separately
    const messageIds = conversation.messages.map(msg => msg.id);
    
    // Save conversation without messages
    await tx.objectStore('conversations').put({
      ...conversation,
      messages: messageIds,
      prompt: conversation.prompt || '',
      temperature: conversation.temperature || 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // Save messages separately with compression
    const messageStore = tx.objectStore('messages');
    for (const message of conversation.messages) {
      // Compress large messages
      let content = message.content;
      if (content.length > 5000) {
        const compressed = pako.deflate(new TextEncoder().encode(content));
        const binaryString = Array.from(compressed)
          .map(byte => String.fromCharCode(byte))
          .join('');
        content = `__compressed__${btoa(binaryString)}`;
      }
      
      await messageStore.put({
        ...message,
        content,
        conversationId: conversation.id,
        createdAt: Date.now(),
      });
    }
    
    await tx.done;
  }
  
  async getConversation(id: string): Promise<Conversation | null> {
    await this.init();
    
    const conversation = await this.db!.get('conversations', id);
    if (!conversation) return null;
    
    // Fetch messages for this conversation
    const messages = await this.getMessagesForConversation(id);
    
    return {
      ...conversation,
      messages,
    } as Conversation;
  }
  
  async getConversations(): Promise<Conversation[]> {
    await this.init();
    
    const conversations = await this.db!.getAll('conversations');
    
    // For listing, we don't load all messages to save memory
    // Return conversations with empty message arrays
    return conversations.map(conv => ({
      ...conv,
      messages: [], // Messages loaded on demand
    })) as Conversation[];
  }
  
  async getMessagesForConversation(
    conversationId: string,
    limit?: number,
    offset: number = 0
  ): Promise<Message[]> {
    await this.init();
    
    const messages = await this.db!.getAllFromIndex(
      'messages',
      'by-conversation',
      conversationId
    );
    
    // Sort by creation time and apply pagination
    const sorted = messages.sort((a, b) => a.createdAt - b.createdAt);
    const paginated = limit 
      ? sorted.slice(offset, offset + limit)
      : sorted;
    
    // Decompress messages if needed
    return paginated.map(msg => {
      let content = msg.content;
      if (content.startsWith('__compressed__')) {
        const base64 = content.substring('__compressed__'.length);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const decompressed = pako.inflate(bytes);
        content = new TextDecoder().decode(decompressed);
      }
      
      return {
        ...msg,
        content,
        type: undefined, // Type is optional in Message interface
      } as Message;
    });
  }
  
  async deleteConversation(id: string): Promise<void> {
    await this.init();
    
    const tx = this.db!.transaction(['conversations', 'messages'], 'readwrite');
    
    // Delete conversation
    await tx.objectStore('conversations').delete(id);
    
    // Delete all messages for this conversation
    const messages = await tx.objectStore('messages')
      .index('by-conversation')
      .getAllKeys(id);
      
    const messageStore = tx.objectStore('messages');
    for (const messageId of messages) {
      await messageStore.delete(messageId);
    }
    
    await tx.done;
  }
  
  // Settings methods
  async saveSetting(key: string, value: any): Promise<void> {
    await this.init();
    await this.db!.put('settings', value, key);
  }
  
  async getSetting(key: string): Promise<any> {
    await this.init();
    return await this.db!.get('settings', key);
  }
  
  // Migration from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const conversationsJson = localStorage.getItem('conversationHistory');
      if (!conversationsJson) return;
      
      const conversations = JSON.parse(conversationsJson);
      
      for (const conversation of conversations) {
        await this.saveConversation(conversation);
      }
      
      // Clear localStorage after successful migration
      localStorage.removeItem('conversationHistory');
      
      console.log(`Migrated ${conversations.length} conversations to IndexedDB`);
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }
  
  // Storage info
  async getStorageInfo(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }
  
  // Cleanup old messages to prevent unbounded growth
  async cleanupOldMessages(daysToKeep: number = 30): Promise<number> {
    await this.init();
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const tx = this.db!.transaction('messages', 'readwrite');
    const messages = await tx.store.getAll();
    
    let deletedCount = 0;
    for (const message of messages) {
      if (message.createdAt < cutoffTime) {
        await tx.store.delete(message.id);
        deletedCount++;
      }
    }
    
    await tx.done;
    return deletedCount;
  }
}

// Export singleton instance
export const indexedDBStorage = new IndexedDBStorage();

// Wrapper functions for drop-in replacement
export const storage = {
  async saveConversations(conversations: Conversation[]): Promise<void> {
    for (const conversation of conversations) {
      await indexedDBStorage.saveConversation(conversation);
    }
  },
  
  async getConversations(): Promise<Conversation[]> {
    // First time: migrate from localStorage
    const needsMigration = localStorage.getItem('conversationHistory') !== null;
    if (needsMigration) {
      await indexedDBStorage.migrateFromLocalStorage();
    }
    
    return await indexedDBStorage.getConversations();
  },
  
  async deleteConversation(id: string): Promise<void> {
    await indexedDBStorage.deleteConversation(id);
  },
  
  async saveSetting(key: string, value: any): Promise<void> {
    await indexedDBStorage.saveSetting(key, value);
  },
  
  async getSetting(key: string): Promise<any> {
    return await indexedDBStorage.getSetting(key);
  },
  
  // New paginated message loading
  async getMessagesPage(
    conversationId: string, 
    pageSize: number = 50,
    page: number = 0
  ): Promise<Message[]> {
    return await indexedDBStorage.getMessagesForConversation(
      conversationId,
      pageSize,
      page * pageSize
    );
  }
};