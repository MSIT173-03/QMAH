import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GameRoomChatMessage } from './game.models';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-game-room-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, QmahIconComponent],
  templateUrl: './game-room-chat.component.html',
  styleUrl: './game-room-chat.component.scss'
})
export class GameRoomChatComponent {
  readonly messages = input<GameRoomChatMessage[]>([]);
  readonly currentPlayerId = input('');
  readonly sending = input(false);
  readonly error = input('');
  readonly disabled = input(false);
  readonly send = output<string>();

  readonly collapsed = signal(true);
  readonly unreadCount = signal(0);
  readonly draft = signal('');
  readonly visibleMessages = computed(() => [...this.messages()]
    .sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt))
    .slice(-100));
  private readonly seenMessageIds = new Set<string>();
  private initialMessagesObserved = false;

  private readonly unreadTracker = effect(() => {
    const messages = this.messages();
    const currentPlayerId = this.currentPlayerId();
    const isOpen = !this.collapsed();

    if (!this.initialMessagesObserved) {
      for (const message of messages) this.rememberMessage(message.id);
      this.initialMessagesObserved = true;
      return;
    }

    const newMessages = messages.filter(message => !this.seenMessageIds.has(message.id));
    for (const message of newMessages) this.rememberMessage(message.id);
    if (isOpen) {
      this.unreadCount.set(0);
      return;
    }
    const incomingCount = newMessages.filter(message => message.gamePlayerId !== currentPlayerId).length;
    if (incomingCount > 0) this.unreadCount.update(count => count + incomingCount);
  });

  togglePanel(): void {
    const opening = this.collapsed();
    this.collapsed.set(!opening);
    if (opening) this.unreadCount.set(0);
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    this.submitMessage();
  }

  submitMessage(): void {
    if (this.disabled() || this.sending()) return;
    const text = this.draft().trim().slice(0, 500);
    if (!text) return;
    this.send.emit(text);
    this.draft.set('');
  }

  formatTime(sentAt: string): string {
    const date = new Date(sentAt);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }

  private rememberMessage(id: string): void {
    if (!id) return;
    this.seenMessageIds.add(id);
    if (this.seenMessageIds.size > 300) {
      const oldest = this.seenMessageIds.values().next().value;
      if (oldest) this.seenMessageIds.delete(oldest);
    }
  }
}
