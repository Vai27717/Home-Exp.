/* Vaibhav Enterprises - Standalone H.Expenses
   H.Expenses logic extracted from the uploaded original app.
   Shared Firestore document: apps/vaibhav_enterprises_data
*/
const KEY = 've_final_v1';
let DATA = { payments: [], paidPayments: [], homeExpenses: [], homeMaterials: [] };

function ensureHExpensesData(data) {
  DATA = data && typeof data === 'object' ? data : {};
  DATA.payments = Array.isArray(DATA.payments) ? DATA.payments : [];
  DATA.paidPayments = Array.isArray(DATA.paidPayments) ? DATA.paidPayments : [];
  DATA.homeExpenses = Array.isArray(DATA.homeExpenses) ? DATA.homeExpenses : [];
  DATA.homeMaterials = Array.isArray(DATA.homeMaterials) ? DATA.homeMaterials : [];
  window.DATA = DATA;
}
function setFirestoreStatus(message, state) {
  const el = document.getElementById('he-firestore-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state || 'info';
}
function applyHExpensesRemoteData(remote) {
  ensureHExpensesData(remote);
  try { localStorage.setItem(KEY, JSON.stringify(DATA)); } catch(e) {}
  renderHExpenses();
  renderHomeMaterials();
}
window.applyHExpensesRemoteData = applyHExpensesRemoteData;
window.getHExpensesFirestorePayload = () => ({
  homeExpenses: DATA.homeExpenses || [],
  homeMaterials: DATA.homeMaterials || []
});

async function saveData() {
  try { localStorage.setItem(KEY, JSON.stringify(DATA)); } catch(e) {}
  renderHExpenses();
  renderHomeMaterials();
  if (typeof window.saveHExpensesToFirestore !== 'function') {
    setFirestoreStatus('Firestore जोडलेले नाही — नोंद Sync झालेली नाही.', 'error');
    alert('Firestore connection उपलब्ध नाही. नोंद Firestore मध्ये Sync झालेली नाही. कृपया connection तपासून पुन्हा प्रयत्न करा.');
    return false;
  }
  try {
    await window.saveHExpensesToFirestore();
    setFirestoreStatus('Firestore Connected • Data Synced', 'success');
    return true;
  } catch (err) {
    console.error('H.Expenses Firestore save error:', err);
    setFirestoreStatus('Firestore Sync अयशस्वी — इंटरनेट / Permission तपासा.', 'error');
    alert('Firestore मध्ये Save झाले नाही. कृपया इंटरनेट आणि Firestore Permission तपासा.');
    return false;
  }
}

function renderHExpenses() {
  const summaryBody = document.getElementById('he-bank-summary');
  const ledgerBody = document.getElementById('he-ledger-rows');
  if (!summaryBody || !ledgerBody) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const amount = value => Number.parseFloat(value) || 0;
  const fmt = value => amount(value).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
  const bankNames = ['Kotak Bank', 'SBI Bank', 'HDFC Bank', 'Cash'];
  const records = [];
  (DATA.payments || []).forEach((p, i) => {
    const credit = amount(p.received);
    if (credit <= 0) return;
    records.push({id:'IN-'+(p.id || `${p.invoiceNo||'NA'}-${p.date||''}-${i}`),source:'ve-in',date:p.date||'',name:p.client||p.name||'—',invoice:p.invoiceNo||'—',bank:p.bank||'Cash',particular:p.note||p.work||'Payment In',credit,debit:0,type:'in'});
  });
  (DATA.paidPayments || []).forEach((p, i) => {
    const debit = amount(p.amount);
    if (debit <= 0) return;
    records.push({id:'OUT-'+(p.id || `${p.invoiceNo||'NA'}-${p.date||''}-${i}`),source:'ve-out',date:p.date||'',name:p.name||p.labor||p.client||'—',invoice:[p.invoiceNo,p.orderId&&p.orderId!=='N/A'?p.orderId:''].filter(Boolean).join(' / ')||'—',bank:p.bank||'Cash',particular:p.note||p.labor||'Payment Out',credit:0,debit,type:'out'});
  });
  (DATA.homeExpenses || []).forEach(r => records.push({...r,source:'home',name:r.description||'Home Expense',invoice:'Home Entry',particular:r.description||'',credit:r.type==='in'?amount(r.amount):0,debit:r.type==='out'?amount(r.amount):0}));

  const bankTotals = Object.fromEntries(bankNames.map(bank => [bank,{credit:0,debit:0}]));
  records.forEach(r => { const bank=r.bank||''; if(!bankTotals[bank]) bankTotals[bank]={credit:0,debit:0}; bankTotals[bank].credit+=amount(r.credit); bankTotals[bank].debit+=amount(r.debit); });
  summaryBody.innerHTML = Object.entries(bankTotals).map(([bank,t])=>`<section class="rounded border p-2"><h4 class="font-bold mb-2">${esc(bank)}</h4><div class="overflow-x-auto"><table class="w-full text-sm" style="min-width:430px"><thead><tr><th>Bank / Account</th><th>Credit (₹)</th><th>Debit (₹)</th><th>Balance (₹)</th></tr></thead><tbody><tr><td>${esc(bank)}</td><td class="text-green-700">₹${fmt(t.credit)}</td><td class="text-red-700">₹${fmt(t.debit)}</td><td class="font-bold">₹${fmt(t.credit-t.debit)}</td></tr></tbody></table></div></section>`).join('');
  // Internal transfers affect individual bank balances, but must not change overall Credit / Debit / Net Balance totals.
  const overallRecords=records.filter(r=>!r.transferId);
  const totalCredit=overallRecords.reduce((a,r)=>a+amount(r.credit),0), totalDebit=overallRecords.reduce((a,r)=>a+amount(r.debit),0);
  document.getElementById('he-total-credit').textContent='₹'+fmt(totalCredit);
  document.getElementById('he-total-debit').textContent='₹'+fmt(totalDebit);
  document.getElementById('he-net-balance').textContent='₹'+fmt(totalCredit-totalDebit);
  const bankFilter=document.getElementById('he-filter-bank').value;
  const from=document.getElementById('he-date-from').value, to=document.getElementById('he-date-to').value;
  const filtered=bankFilter ? records.filter(r=>r.bank===bankFilter&&(!from||r.date>=from)&&(!to||r.date<=to)).sort((a,b)=>String(b.date).localeCompare(String(a.date))) : [];
  ledgerBody.innerHTML=filtered.map(r=>`<tr><td>${esc(r.date||'—')}</td><td>${esc(r.name)}</td><td>${esc(r.invoice||'—')}</td><td>${esc(r.bank||'—')}</td><td>${esc(r.particular||'—')}</td><td class="text-green-700">${r.credit?'₹'+fmt(r.credit):'—'}</td><td class="text-red-700">${r.debit?'₹'+fmt(r.debit):'—'}</td><td>${r.source==='home'?(r.transferId?`<button class="smallbtn" onclick="deleteHomeExpense('${esc(r.id)}')">Delete Transfer</button>`:`<button class="smallbtn" onclick="editHomeExpense('${esc(r.id)}')">Edit</button> <button class="smallbtn" onclick="deleteHomeExpense('${esc(r.id)}')">Delete</button>`):'Auto'}</td></tr>`).join('');
  const no=document.getElementById('he-no-records'); no.style.display=filtered.length?'none':'block';
  no.textContent=bankFilter?(filtered.length?'':'या Bank / Date Filter साठी कोणतीही नोंद नाही.'):'कृपया Bank निवडा. Bank निवडल्याशिवाय नोंदी दिसणार नाहीत.';
}

let homeTransferMode = false;
function toggleHomeTransferMode(){
  if(homeTransferMode){ saveHomeExpense(); return; }
  homeTransferMode = true;
  document.getElementById('he-transfer-to-wrap').style.display = homeTransferMode ? 'block' : 'none';
  document.getElementById('he-transfer-button').textContent = homeTransferMode ? '✓ Complete Transfer' : '⇄ Transfer';
  document.getElementById('he-entry-type').disabled = homeTransferMode;
  if(homeTransferMode) document.getElementById('he-entry-type').value = '';
  else document.getElementById('he-transfer-to-bank').value = '';
}
function resetHomeExpenseForm(){
  ['he-edit-id','he-entry-bank','he-entry-type','he-entry-amount','he-entry-description','he-transfer-to-bank'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('he-entry-date').value=new Date().toISOString().slice(0,10);
  homeTransferMode=false;
  document.getElementById('he-transfer-to-wrap').style.display='none';
  document.getElementById('he-transfer-button').textContent='⇄ Transfer';
  document.getElementById('he-entry-type').disabled=false;
}
async function saveHomeExpense(){
  const id=document.getElementById('he-edit-id').value, date=document.getElementById('he-entry-date').value, bank=document.getElementById('he-entry-bank').value, type=document.getElementById('he-entry-type').value, amount=Number(document.getElementById('he-entry-amount').value), description=document.getElementById('he-entry-description').value.trim();
  DATA.homeExpenses=DATA.homeExpenses||[];
  if(homeTransferMode){
    const toBank=document.getElementById('he-transfer-to-bank').value;
    if(!date||!bank||!toBank||bank===toBank||!description||!(amount>0)){alert('कृपया Date, From Bank, To Bank, Amount आणि Description भरा. दोन्ही Bank वेगळे निवडा.');return;}
    const transferId='HT-'+Date.now();
    DATA.homeExpenses.push({id:transferId+'-OUT',transferId,date,bank,type:'out',amount,description:'Transfer to '+toBank+' - '+description});
    DATA.homeExpenses.push({id:transferId+'-IN',transferId,date,bank:toBank,type:'in',amount,description:'Transfer from '+bank+' - '+description});
    const saved = await saveData(); if(saved) resetHomeExpenseForm(); return;
  }
  if(!date||!bank||!type||!description||!(amount>0)){alert('कृपया Date, Bank, Payment In/Out, Amount आणि Description भरा.');return;}
  const row={id:id||('HE-'+Date.now()),date,bank,type,amount,description};
  const index=DATA.homeExpenses.findIndex(r=>String(r.id)===String(id));
  if(index>=0) DATA.homeExpenses[index]=row; else DATA.homeExpenses.push(row);
  const saved = await saveData(); if(saved) resetHomeExpenseForm();
}
function editHomeExpense(id){
  const r=(DATA.homeExpenses||[]).find(x=>String(x.id)===String(id)); if(!r)return;
  document.getElementById('he-edit-id').value=r.id; document.getElementById('he-entry-date').value=r.date||''; document.getElementById('he-entry-bank').value=r.bank||''; document.getElementById('he-entry-type').value=r.type||''; document.getElementById('he-entry-amount').value=r.amount||''; document.getElementById('he-entry-description').value=r.description||'';
  document.getElementById('h-expenses').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteHomeExpense(id){
  if(!confirm('ही Home Expense नोंद Delete करायची आहे का?')) return;
  const row=(DATA.homeExpenses||[]).find(r=>String(r.id)===String(id));
  DATA.homeExpenses=(DATA.homeExpenses||[]).filter(r=>row&&row.transferId?String(r.transferId)!==String(row.transferId):String(r.id)!==String(id));
  await saveData();
  if(document.getElementById('he-edit-id').value===String(id)) resetHomeExpenseForm();
}
function exportHomeExpensesPDF(){
  const bank=document.getElementById('he-filter-bank').value;
  if(!bank){alert('PDF काढण्यासाठी आधी Bank निवडा.');return;}
  if(!window.jspdf||!window.jspdf.jsPDF){alert('PDF library load झाली नाही.');return;}
  const from=document.getElementById('he-date-from').value,to=document.getElementById('he-date-to').value;
  const rows=[];
  (DATA.payments||[]).forEach(p=>{
    const amountIn=Number(p.received)||0;
    if((p.bank||'Cash')===bank&&amountIn>0&&(!from||p.date>=from)&&(!to||p.date<=to))
      rows.push([p.date||'',p.client||p.name||'—',p.note||p.work||'Payment In',amountIn,0]);
  });
  (DATA.paidPayments||[]).forEach(p=>{
    const amountOut=Number(p.amount)||0;
    if((p.bank||'Cash')===bank&&amountOut>0&&(!from||p.date>=from)&&(!to||p.date<=to))
      rows.push([p.date||'',p.name||p.labor||p.client||'—',p.note||p.labor||'Payment Out',0,amountOut]);
  });
  (DATA.homeExpenses||[]).forEach(r=>{
    if(r.bank===bank&&(!from||r.date>=from)&&(!to||r.date<=to))
      rows.push([r.date||'',r.description||'Home Expense',r.description||'Home Expense',r.type==='in'?(Number(r.amount)||0):0,r.type==='out'?(Number(r.amount)||0):0]);
  });
  rows.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const totalCredit=rows.reduce((sum,r)=>sum+(Number(r[3])||0),0);
  const totalDebit=rows.reduce((sum,r)=>sum+(Number(r[4])||0),0);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
  const margin=12, tableW=pageW-margin*2;
  const widths=[25,45,113,45,45];
  const headers=['Date','Name','Description / Particular','Credit (IN)','Debit (OUT)'];
  const fmt=n=>(Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  let y=12;
  function drawReportHeading(){
    doc.setFillColor(24,45,72);doc.roundedRect(margin,y,tableW,19,2,2,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);
    doc.text('HOME EXPENSES - BANK WISE REPORT',margin+5,y+7);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    doc.text('Bank: '+bank+'   |   Period: '+(from||'Beginning')+' to '+(to||'Today'),margin+5,y+14);
    y+=25;
    drawTableHeader();
  }
  function drawTableHeader(){
    let x=margin;const h=9;
    headers.forEach((head,i)=>{
      if(i===3)doc.setFillColor(20,125,65);else if(i===4)doc.setFillColor(180,35,45);else doc.setFillColor(52,73,94);
      doc.rect(x,y,widths[i],h,'F');doc.setDrawColor(255,255,255);doc.rect(x,y,widths[i],h,'S');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8);
      const lines=doc.splitTextToSize(head,widths[i]-3);doc.text(lines,x+1.5,y+5.8);x+=widths[i];
    });y+=h;
  }
  drawReportHeading();
  doc.setFont('helvetica','normal');doc.setFontSize(8);
  rows.forEach((r,index)=>{
    const cells=[String(r[0]||'—'),String(r[1]||'—'),String(r[2]||'—'),fmt(r[3]),fmt(r[4])];
    const wrapped=cells.map((v,i)=>doc.splitTextToSize(v,widths[i]-4));
    const rowH=Math.max(8,...wrapped.map(lines=>lines.length*4+3));
    if(y+rowH+18>pageH){doc.addPage();y=12;drawReportHeading();doc.setFont('helvetica','normal');doc.setFontSize(8);}
    if(index%2===0)doc.setFillColor(244,247,250);else doc.setFillColor(255,255,255);
    doc.rect(margin,y,tableW,rowH,'F');
    let x=margin;
    wrapped.forEach((lines,i)=>{
      doc.setDrawColor(205,213,220);doc.rect(x,y,widths[i],rowH,'S');
      if(i===3)doc.setTextColor(20,125,65);else if(i===4)doc.setTextColor(180,35,45);else doc.setTextColor(35,43,52);
      doc.setFont('helvetica',(i===3||i===4)?'bold':'normal');
      doc.text(lines,x+2,y+4.8);x+=widths[i];
    });
    y+=rowH;
  });
  const totalH=10;
  if(y+totalH+8>pageH){doc.addPage();y=12;drawReportHeading();}
  doc.setFillColor(230,235,240);doc.rect(margin,y,tableW,totalH,'F');
  let x=margin;
  const totalCells=['','','TOTAL',fmt(totalCredit),fmt(totalDebit)];
  totalCells.forEach((value,i)=>{
    doc.setDrawColor(150,160,170);doc.rect(x,y,widths[i],totalH,'S');
    if(i===3){doc.setTextColor(20,125,65);doc.setFillColor(218,245,226);doc.rect(x,y,widths[i],totalH,'F');doc.setDrawColor(150,160,170);doc.rect(x,y,widths[i],totalH,'S');}
    else if(i===4){doc.setTextColor(180,35,45);doc.setFillColor(255,225,228);doc.rect(x,y,widths[i],totalH,'F');doc.setDrawColor(150,160,170);doc.rect(x,y,widths[i],totalH,'S');}
    else doc.setTextColor(35,43,52);
    doc.setFont('helvetica','bold');doc.setFontSize(8);if(value)doc.text(value,x+2,y+6.2);x+=widths[i];
  });
  doc.setTextColor(35,43,52);doc.setFont('helvetica','bold');doc.setFontSize(9);
  if(y+9>pageH-10){doc.addPage();y=15;} else {y+=totalH+5;}
  doc.setFillColor(235,239,243);doc.roundedRect(margin,y,tableW,9,1,1,'F');
  doc.setTextColor(35,43,52);doc.text('TOTAL CREDIT: INR '+fmt(totalCredit),margin+4,y+6);
  doc.setTextColor(180,35,45);doc.text('TOTAL DEBIT: INR '+fmt(totalDebit),margin+tableW/2,y+6);
  doc.setTextColor(20,100,55);doc.text('NET BALANCE: INR '+fmt(totalCredit-totalDebit),margin+tableW-4,y+6,{align:'right'});
  doc.setTextColor(100,100,100);doc.setFont('helvetica','normal');doc.setFontSize(7);
  const pageCount=doc.internal.getNumberOfPages();
  for(let pg=1;pg<=pageCount;pg++){doc.setPage(pg);doc.text('Vaibhav Enterprises - Page '+pg+' of '+pageCount, pageW-margin,pageH-5,{align:'right'});}
  doc.save('Home_Expenses_'+bank.replace(/\s/g,'_')+'.pdf');
}
function openHomeMaterialModal(){document.getElementById('he-material-modal').style.display='block';renderHomeMaterials();}
function closeHomeMaterialModal(){document.getElementById('he-material-modal').style.display='none';}
function renderHomeMaterials(){const body=document.getElementById('he-material-rows');if(!body)return;body.innerHTML=(DATA.homeMaterials||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${String(r.name||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</td><td>${Number(r.qty)||1}</td><td>${String(r.unit||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</td><td><button class="smallbtn" onclick="changeHomeMaterialQty(${i},-1)">−</button> <button class="smallbtn" onclick="changeHomeMaterialQty(${i},1)">+</button></td><td><button class="smallbtn" onclick="removeHomeMaterialRow(${i})">Delete</button></td></tr>`).join('');}
function addHomeMaterialRow(){const name=document.getElementById('he-mat-name').value.trim(),unit=document.getElementById('he-mat-unit').value.trim();if(!name||!unit){alert('Name आणि Unit भरा.');return;}DATA.homeMaterials=DATA.homeMaterials||[];const qty=Math.max(1,Number(document.getElementById('he-mat-qty').value)||1);DATA.homeMaterials.push({name,unit,qty});document.getElementById('he-mat-name').value='';document.getElementById('he-mat-unit').value='';document.getElementById('he-mat-qty').value='1';renderHomeMaterials();}
function changeHomeMaterialQty(i,delta){const r=DATA.homeMaterials[i];if(!r)return;r.qty=Math.max(1,(Number(r.qty)||1)+delta);renderHomeMaterials();}
function removeHomeMaterialRow(i){DATA.homeMaterials.splice(i,1);renderHomeMaterials();}
async function saveHomeMaterials(){
  const ok = await saveData();
  if(ok) alert('Material List Save झाली.');
}
function shareHomeMaterialsWhatsApp(){const rows=DATA.homeMaterials||[];if(!rows.length){alert('आधी Material Items Add करा.');return;}const msg='Home Material List\n'+rows.map((r,i)=>`${i+1}. ${r.name} - ${r.qty||1} ${r.unit}`).join('\n');window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');}

window.addEventListener('DOMContentLoaded',()=>{const d=document.getElementById('he-entry-date');if(d&&!d.value)d.value=new Date().toISOString().slice(0,10);});

window.addEventListener('DOMContentLoaded', () => {
  const d = document.getElementById('he-entry-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  renderHExpenses();
});

setTimeout(() => {
  if (!window.__heFirebaseConnected) {
    setFirestoreStatus('Firebase SDK / Firestore load झाले नाही. HTTPS Hosting आणि Internet तपासा.', 'error');
  }
}, 15000);


// Standalone app initialization + explicit global handlers for inline HTML buttons.
(function initStandaloneHExpenses(){
  try {
    const cached = localStorage.getItem(KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') ensureHExpensesData(parsed);
    }
  } catch (e) { console.warn('Local cache could not be loaded:', e); }
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const dateInput = document.getElementById('he-entry-date');
  if (dateInput && !dateInput.value) dateInput.value = localDate;
  // Publish every function referenced by onclick attributes.
  Object.assign(window, {
    renderHExpenses, saveHomeExpense, toggleHomeTransferMode, resetHomeExpenseForm,
    editHomeExpense, deleteHomeExpense, exportHomeExpensesPDF,
    openHomeMaterialModal, closeHomeMaterialModal, renderHomeMaterials,
    addHomeMaterialRow, changeHomeMaterialQty, removeHomeMaterialRow,
    saveHomeMaterials, shareHomeMaterialsWhatsApp
  });
  renderHExpenses();
  renderHomeMaterials();
})();
