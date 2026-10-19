/* NONSTOP AI — shared enquiry form renderer.
   Posts to Netlify Forms as "service-enquiry" (registered statically in /forms/index.html).
   Deliberately does NOT call /api/demo-request or Supabase (keeps receptionist CRM clean). */
(function(){
  'use strict';
  var root=document.getElementById('enquiry-root');
  if(!root)return;
  var FORM='service-enquiry',PHONE_TEL='tel:+447360266496',PHONE='07360 266496';
  var SERVICES=['Product Video Ads','Business Automation','Website Machine','AI Receptionist','Not sure'];
  var defSvc=root.getAttribute('data-service')||'Not sure';
  var pkgs=[];try{pkgs=JSON.parse(root.getAttribute('data-packages')||'[]')}catch(e){}
  var pkgLabel=root.getAttribute('data-package-label')||'What do you need?';
  var KEY='nsai_svc_attr';
  var P=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'];

  function ss(op,k,v){try{return op==='g'?sessionStorage.getItem(k):sessionStorage.setItem(k,v)}catch(e){return null}}
  function attribution(){
    var a={};try{a=JSON.parse(ss('g',KEY)||'{}')||{}}catch(e){a={}}
    if(!a._set){ // first touch only
      try{var q=new URLSearchParams(location.search);P.forEach(function(p){var v=q.get(p);if(v)a[p]=v.slice(0,200)})}catch(e){}
      a.referrer=(document.referrer||'').slice(0,300);a._set=1;ss('s',KEY,JSON.stringify(a));
    }
    return a;
  }
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function opts(list,sel){return list.map(function(o){return '<option'+(o===sel?' selected':'')+'>'+esc(o)+'</option>'}).join('')}

  var at=attribution();
  var hidden=['source_page'].concat(P,['referrer']).map(function(n){
    var v=n==='source_page'?location.pathname:(at[n]||'');
    return '<input type="hidden" name="'+n+'" value="'+esc(v)+'">';
  }).join('');

  root.innerHTML=
   '<div class="formcard"><form id="enquiry-form" name="'+FORM+'" method="POST" novalidate>'+
   '<input type="hidden" name="form-name" value="'+FORM+'">'+hidden+
   '<p class="hp" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>'+
   '<div class="fgrid two">'+
    '<div><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required></div>'+
    '<div><label for="f-biz">Business name</label><input id="f-biz" name="business_name" autocomplete="organization" required></div>'+
    '<div><label for="f-email">Email</label><input id="f-email" name="email" type="email" inputmode="email" autocomplete="email" required></div>'+
    '<div><label for="f-phone">Phone <small>(optional)</small></label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"></div>'+
    '<div><label for="f-svc">Service</label><select id="f-svc" name="service">'+opts(SERVICES,defSvc)+'</select></div>'+
    '<div><label for="f-pkg">'+esc(pkgLabel)+'</label><select id="f-pkg" name="package">'+opts(pkgs,pkgs[pkgs.length-1])+'</select></div>'+
   '</div>'+
   '<div style="margin-top:14px"><label for="f-msg">Tell us a little about it <small>(optional)</small></label><textarea id="f-msg" name="message"></textarea></div>'+
   '<p class="err" id="f-err" role="alert" hidden></p>'+
   '<div style="margin-top:18px"><button class="btn pri" type="submit" style="width:100%">'+esc(root.getAttribute('data-submit')||'Send enquiry')+'</button></div>'+
   '<p class="priv">No payment is taken. We use your details only to reply to this enquiry. See our <a href="/privacy/">privacy policy</a>.</p>'+
   '</form></div>';

  var f=document.getElementById('enquiry-form'),err=document.getElementById('f-err');
  function fail(m){err.innerHTML=m;err.hidden=false}
  f.addEventListener('submit',function(e){
    e.preventDefault();err.hidden=true;
    if(f.elements['bot-field'].value)return; // bot
    var n=f.elements.name.value.trim(),b=f.elements.business_name.value.trim(),em=f.elements.email.value.trim();
    if(!n||!b)return fail('Please add your name and business name.');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return fail('Please enter a valid email address.');
    var btn=f.querySelector('button[type=submit]'),label=btn.textContent;
    btn.disabled=true;btn.textContent='Sending…';
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f)).toString()})
     .then(function(r){
       if(!r.ok)throw new Error('http '+r.status);
       root.innerHTML='<div class="formcard thanks" role="status"><h3>Thanks — we’ve got your enquiry.</h3><p>We’ll review it and get back to you by email. No payment is needed at this stage.</p></div>';
       root.scrollIntoView({block:'center'});
     })
     .catch(function(){
       btn.disabled=false;btn.textContent=label;
       fail('Sorry, that didn’t send. Please try again, or call us on <a href="'+PHONE_TEL+'">'+PHONE+'</a>.');
     });
  });
})();
