import { describe, expect, it } from 'vitest';
import { placePiece } from './game-placement-board.component';
import { TestBed } from '@angular/core/testing';
import { GamePlacementBoardComponent } from './game-placement-board.component';
import { vi } from 'vitest';

describe('piece placement', () => {
  it('places a tray piece without changing the source array', () => {
    const order = [-1, -1, -1];
    expect(placePiece(order, 2, 1)).toEqual([-1, 2, -1]);
    expect(order).toEqual([-1, -1, -1]);
  });
  it('returns the displaced piece to the tray instead of swapping', () => {
    expect(placePiece([2, 1, -1], 2, 1)).toEqual([-1, 2, -1]);
  });
  it('rejects out of range pieces', () => {
    expect(placePiece([-1, -1], 3, 0)).toEqual([-1, -1]);
  });
});

describe('玩家自行選擇背景協助', () => {
  function setup() {
    const fixture = TestBed.createComponent(GamePlacementBoardComponent);
    fixture.componentRef.setInput('image', '/image.png');
    fixture.componentRef.setInput('name', '測試文物');
    fixture.componentRef.setInput('order', [0, -1, 3, -1]);
    fixture.componentRef.setInput('columns', 2);
    fixture.componentRef.setInput('rows', 2);
    const board = fixture.componentInstance;
    board.ready.set(true);
    board.backgroundPieces.set([0, 1, 2]);
    board.orderChange.subscribe(order => fixture.componentRef.setInput('order', order));
    return { fixture, board };
  }

  it('預覽不改盤面，取消勾選的候選保持原樣，歸位後不自動結算', () => {
    const { board } = setup();
    const assistance = vi.fn();
    const settlement = vi.fn();
    board.autoCompleted.subscribe(assistance);
    board.settlementRequested.subscribe(settlement);
    board.prepareBackground();
    expect(board.order()).toEqual([0, -1, 3, -1]);
    board.setBackgroundSelected(1, { target: { checked: false } } as unknown as Event);
    board.placeBackground();
    expect(board.order()).toEqual([0, -1, 2, -1]);
    expect(assistance).toHaveBeenCalledWith(1);
    expect(settlement).not.toHaveBeenCalled();
    board.placeBackground();
    expect(assistance).toHaveBeenCalledTimes(1);
  });

  it('累計輔助後顯示正確的新增扣分，禁用盤面不接受協助', () => {
    const { fixture, board } = setup();
    fixture.componentRef.setInput('order', Array(25).fill(-1));
    fixture.componentRef.setInput('assistedPieces', 1);
    board.backgroundPieces.set([1]);
    board.prepareBackground();
    expect(board.backgroundPenalty()).toBe(2);
    fixture.componentRef.setInput('order', Array.from({ length: 25 }, (_, index) => index === 24 ? -1 : index));
    expect(board.assistancePenalty()).toBe(2);
    fixture.componentRef.setInput('order', Array(25).fill(-1));
    fixture.componentRef.setInput('disabled', true);
    board.placeBackground();
    expect(board.order().every(piece => piece === -1)).toBe(true);
  });

  it('方向鍵依備選區的空位保持欄位，不在左右邊界跨列', () => {
    const { board } = setup();
    const grid = document.createElement('div');
    grid.innerHTML = '<button>第一格</button><span></span><button>第三格</button><button>第四格</button>';
    document.body.append(grid);
    const buttons = grid.querySelectorAll('button');
    buttons[0].focus();
    board.moveFocus({ key: 'ArrowDown', currentTarget: buttons[0], preventDefault: vi.fn() } as unknown as KeyboardEvent, 0);
    expect(document.activeElement).toBe(buttons[1]);
    buttons[0].focus();
    board.moveFocus({ key: 'ArrowRight', currentTarget: buttons[0], preventDefault: vi.fn() } as unknown as KeyboardEvent, 0);
    expect(document.activeElement).toBe(buttons[0]);
    grid.remove();
  });

  it('手機碎片匣方向鍵依實際欄數移動，不沿用原圖欄數', () => {
    const { board } = setup();
    const grid = document.createElement('div');
    grid.className = 'is-compact';
    grid.style.gridTemplateColumns = '60px 60px 60px';
    grid.innerHTML = '<button>一</button><button>二</button><button>三</button><button>四</button>';
    document.body.append(grid);
    const buttons = grid.querySelectorAll('button');
    buttons[0].focus();
    board.moveFocus({ key: 'ArrowDown', currentTarget: buttons[0], preventDefault: vi.fn() } as unknown as KeyboardEvent, 0);
    expect(document.activeElement).toBe(buttons[3]);
    grid.remove();
  });
});
