import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GameRoomChatComponent } from './game-room-chat.component';

const message = (id: string, sentAt = '2026-10-03T12:00:00Z') => ({ id, gamePlayerId: 'other', displayName: '同桌玩家', text: '聊天紀錄', sentAt });

async function setup() {
  const fixture = TestBed.createComponent(GameRoomChatComponent);
  fixture.componentRef.setInput('messages', [message('first')]);
  fixture.componentInstance.togglePanel();
  fixture.detectChanges();
  await fixture.whenStable();
  const log = fixture.nativeElement.querySelector('.chat-messages') as HTMLOListElement;
  Object.defineProperties(log, { scrollHeight: { value: 1000, configurable: true }, clientHeight: { value: 200, configurable: true } });
  return { fixture, log, chat: fixture.componentInstance };
}

describe('聊天室歷史閱讀', () => {
  it('閱讀舊訊息時，新訊息不改變捲動位置', async () => {
    const { fixture, log, chat } = await setup();
    log.scrollTop = 120;
    log.dispatchEvent(new Event('scroll'));
    expect(chat.atLatest()).toBe(false);
    fixture.componentRef.setInput('messages', [message('first'), message('new')]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(log.scrollTop).toBe(120);
    expect(chat.unreadCount()).toBe(1);
    chat.togglePanel();
    fixture.detectChanges();
    chat.togglePanel();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(log.scrollTop).toBe(120);
    expect(fixture.nativeElement.querySelector('.chat-latest')).not.toBeNull();
    fixture.nativeElement.querySelector('.chat-latest').click();
    expect(log.scrollTop).toBe(1000);
  });

  it('長訊息摘要可展開全文，送出後仍可接著輸入', async () => {
    const { fixture, chat } = await setup();
    const long = { ...message('long'), text: '完整的文物觀察內容。'.repeat(30) };
    fixture.componentRef.setInput('messages', [long]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.message-bubble p').textContent.length).toBeLessThan(long.text.length);
    fixture.nativeElement.querySelector('.message-expand').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.message-bubble p').textContent).toBe(long.text);
    chat.draft.set('下一則訊息');
    chat.submitMessage();
    expect(document.activeElement?.id).toBe('game-room-chat-input');
  });

  it('停留在最新訊息時會跟上新訊息', async () => {
    const { fixture, log, chat } = await setup();
    log.scrollTop = 800;
    log.dispatchEvent(new Event('scroll'));
    expect(chat.atLatest()).toBe(true);
    fixture.componentRef.setInput('messages', [message('first'), message('new')]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(log.scrollTop).toBe(1000);
  });

  it('跨日期保留日期分隔，遊戲結束後仍顯示歷史', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('messages', [message('yesterday', '2026-10-02T12:00:00Z'), message('today')]);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.chat-date').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.chat-message').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.chat-compose')).toBeNull();
  });
});
