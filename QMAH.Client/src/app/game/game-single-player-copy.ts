/** 選擇玩法、正式挑戰與玩法展示共用既有單人遊戲說明。 */
export function singlePlayerMechanic(code: string): readonly [string, string] {
  return ({
    DETAIL_LOCATOR: ['看準心，在原圖上點出同一位置。', '簡單有區域提示，困難全靠眼力。'],
    MEMORY_MATCH: ['翻開 16 張牌，配出 8 組相同文物。', '先看牌面 5 秒，簡單可求助，困難不行。'],
    ARTIFACT_PUZZLE: ['把 25 塊碎片拖進格子，拼回原圖。', '簡單可對照原圖，困難只先看 10 秒。'],
    STRIP_RESTORE: ['把 15 片碎片排回原位，拼回原畫。', '簡單相鄰兩片交換，困難滑進空格。']
  } as Record<string, readonly [string, string]>)[code] ?? ['完成盤面後查看結算。', '開始前選簡單或困難。'];
}
