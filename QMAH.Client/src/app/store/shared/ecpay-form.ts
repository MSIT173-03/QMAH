import { EcpayCheckoutForm } from '../api/api.models';

/**
 * 以瀏覽器自己的表單 POST 前往綠界付款頁：動態組一個真正的 <form> 並 submit，
 * 綠界收到的是帶正確簽章的瀏覽器請求，不是 fetch／XHR 代打（那樣會被 CORS 擋下或只拿到 HTML 字串）。
 * target 為 _blank 時必須在點擊事件裡同步呼叫，否則新分頁會被瀏覽器當成快顯視窗擋下；
 * 需要先等 API 回應時，改在點擊當下先開好具名視窗，再把 target 指向該視窗名稱。
 */
export function submitEcpayForm(document: Document, checkout: EcpayCheckoutForm, target: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.actionUrl;
  form.target = target;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(checkout.fields)) {
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    field.value = value;
    form.appendChild(field);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
