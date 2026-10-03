import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GameRoomComponent } from './game-room.component';

function setup() {
  const response = new Subject<{ gamePlayerId: string }>();
  const context = {
    currentPlayerId:'self', round:{ id:'round' }, now:0, testMode:false,
    answerType:'FACTUAL_REASONING', answerText:'保留我的回答', submittingAnswer:false,
    hasSubmittedAnswer:()=>false, clearDraft:vi.fn(), closeRoomPanel:vi.fn(),
    destroyRef:{ destroyed:false, onDestroy:()=>()=>{} }, changeDetector:{ markForCheck:vi.fn() },
    game:{ canAnswer:()=>true, submitAnswer:vi.fn(()=>response), errorMessage:()=> '連線失敗' },
    actionError:'', actionMessage:'', submittedRoundId:''
  };
  const submit = () => GameRoomComponent.prototype.submitAnswer.call(context as unknown as GameRoomComponent);
  return { context, response, submit };
}

describe('回答確認送出', () => {
  it('等待成功回覆才清除草稿與關閉視窗，等待期間不重送', () => {
    const { context, response, submit } = setup();
    submit(); submit();
    expect(context.game.submitAnswer).toHaveBeenCalledTimes(1);
    expect(context.closeRoomPanel).not.toHaveBeenCalled();
    expect(context.answerText).toBe('保留我的回答');
    response.next({ gamePlayerId:'self' }); response.complete();
    expect(context.closeRoomPanel).toHaveBeenCalledWith('answer');
    expect(context.clearDraft).toHaveBeenCalledWith('round');
    expect(context.submittingAnswer).toBe(false);
  });

  it('失敗時保留回答與視窗，允許再次送出', () => {
    const { context, response, submit } = setup();
    submit(); response.error(new Error('offline'));
    expect(context.closeRoomPanel).not.toHaveBeenCalled();
    expect(context.clearDraft).not.toHaveBeenCalled();
    expect(context.answerText).toBe('保留我的回答');
    expect(context.actionError).toBe('連線失敗');
    expect(context.submittingAnswer).toBe(false);
  });
});
