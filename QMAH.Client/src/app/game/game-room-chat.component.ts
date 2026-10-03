import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, afterRenderEffect, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GameRoomChatMessage } from './game.models';
import { gamePlayerColor } from './game-player-colors';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-game-room-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closePanel($event)' },
  imports: [FormsModule, QmahIconComponent],
  templateUrl: './game-room-chat.component.html',
  styleUrl: './game-room-chat.component.scss'
})
export class GameRoomChatComponent {
  @ViewChild('chatToggle') private chatToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild('messageLog') private messageLog?: ElementRef<HTMLOListElement>;
  @ViewChild('messageInput') private messageInput?: ElementRef<HTMLTextAreaElement>;
  readonly messages = input<GameRoomChatMessage[]>([]);
  readonly currentPlayerId = input('');
  readonly sending = input(false);
  readonly error = input('');
  readonly disabled = input(false);
  readonly send = output<string>();
  readonly panelOpenChange = output<boolean>();
  readonly playerColors = input<Record<string, string>>({});
  playerColor(id: string): string { return gamePlayerColor(this.playerColors()[id]); }

  readonly collapsed = signal(true);
  readonly unreadCount = signal(0);
  readonly draft = signal('');
  readonly atLatest = signal(true);
  readonly expandedMessages = signal<ReadonlySet<string>>(new Set());
  private panelWasOpen = false;
  readonly visibleMessages = computed(() => [...this.messages()]
    .sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt))
    .slice(-100));
  readonly transcript = computed(() => {
    const messages = this.visibleMessages();
    return messages.map((message, index) => {
      const date = new Date(message.sentAt);
      const previous = index > 0 ? messages[index - 1] : null;
      const startsDay = !previous || new Date(previous.sentAt).toDateString() !== date.toDateString();
      return {
        message,
        dateLabel: startsDay && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }).format(date) : null,
        continuation: !startsDay && previous?.gamePlayerId === message.gamePlayerId && date.getTime() - Date.parse(previous.sentAt) < 300000
      };
    });
  });
  private readonly followLatest = afterRenderEffect(() => {
    const isOpen = !this.collapsed();
    this.visibleMessages();
    untracked(() => {
      if (isOpen && this.atLatest()) this.jumpToLatest();
      else if (!isOpen && this.panelWasOpen) this.chatToggle?.nativeElement.focus({ preventScroll: true });
      this.panelWasOpen = isOpen;
    });
  });
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
    if (isOpen && this.atLatest()) {
      this.unreadCount.set(0);
      return;
    }
    const incomingCount = newMessages.filter(message => message.gamePlayerId !== currentPlayerId).length;
    if (incomingCount > 0) this.unreadCount.update(count => count + incomingCount);
  });

  togglePanel(): void {
    const opening = this.collapsed();
    this.collapsed.set(!opening);
    this.panelOpenChange.emit(opening);
    if (opening && this.atLatest()) this.unreadCount.set(0);
  }

  closePanel(event: Event): void {
    if (this.collapsed()) return;
    event.stopPropagation();
    this.collapsed.set(true);
    this.panelOpenChange.emit(false);
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
    this.atLatest.set(true);
    this.messageInput?.nativeElement.focus({ preventScroll: true });
  }

  messageText(message: GameRoomChatMessage): string {
    return message.text.length > 160 && !this.expandedMessages().has(message.id)
      ? Array.from(message.text).slice(0, 100).join('') + '…' : message.text;
  }

  toggleMessage(id: string): void {
    this.expandedMessages.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  updateScrollPosition(): void {
    const log = this.messageLog?.nativeElement;
    if (log) this.atLatest.set(log.scrollHeight - log.scrollTop - log.clientHeight < 40);
  }

  jumpToLatest(focusLog = false): void {
    const log = this.messageLog?.nativeElement;
    if (log) log.scrollTop = log.scrollHeight;
    this.atLatest.set(true);
    if (focusLog) log?.focus({ preventScroll: true });
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
