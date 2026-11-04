/** Stable public integration for private UI images; missing packs retain the generated skin. */
import { packUrl } from '../art/packs';
import './packSkin.css';
export function installPackSkin() {
  const files=['sl_panel','sl_dialog','sl_btn','sl_btn_down','sl_frame'];
  const urls=files.map(id=>packUrl(`ui/${id}.png`));
  if(urls.some(u=>!u))return;
  files.forEach((id,i)=>document.documentElement.style.setProperty(`--pack-${id}`,`url("${urls[i]}")`));
  document.documentElement.classList.add('pack-ui');
}
