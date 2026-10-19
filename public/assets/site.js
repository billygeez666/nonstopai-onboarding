/* NONSTOP AI — shared behaviour for static service pages. No tracking, no cookies. */
(function(){
  'use strict';
  var reduce=false,saveData=false;
  try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  try{saveData=!!(navigator.connection&&navigator.connection.saveData)}catch(e){}
  var calm=reduce||saveData;

  /* CTA -> scroll to enquiry with service/package preselected */
  document.addEventListener('click',function(e){
    var a=e.target.closest('[data-cta="enquiry"]');
    if(!a)return;
    var form=document.getElementById('enquiry-form');
    var target=document.getElementById('enquiry');
    if(!target)return;
    e.preventDefault();
    if(form){
      var pk=a.getAttribute('data-package'),sv=a.getAttribute('data-service');
      if(sv&&form.elements.service)form.elements.service.value=sv;
      if(pk&&form.elements.package)form.elements.package.value=pk;
    }
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    setTimeout(function(){var f=document.getElementById('f-name');if(f)f.focus({preventScroll:true})},reduce?0:500);
  });

  /* videos */
  function load(v){
    if(v.getAttribute('src'))return;
    v.src=v.getAttribute('data-src');
  }
  var vids=[].slice.call(document.querySelectorAll('video[data-auto]'));
  if(vids.length&&'IntersectionObserver' in window&&!calm){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(en){
        var v=en.target;
        if(en.isIntersecting){load(v);var p=v.play();if(p&&p.catch)p.catch(function(){})}
        else if(v.getAttribute('src')){v.pause()}
      });
    },{threshold:.35});
    vids.forEach(function(v){io.observe(v)});
  }
  /* calm mode (reduced motion / data saver): poster only, no autoplay; give hero controls so it can be played manually (preload=none keeps it from downloading) */
  if(calm)vids.forEach(function(v){load(v);v.controls=true;v.removeAttribute('loop')});

  function pauseAll(except){
    [].forEach.call(document.querySelectorAll('.vid video'),function(v){if(v!==except&&!v.paused)v.pause()});
  }
  /* tap-to-play cards: with sound where an audio version exists */
  [].forEach.call(document.querySelectorAll('[data-play]'),function(btn){
    btn.addEventListener('click',function(){
      var box=btn.closest('.vid'),v=box.querySelector('video');
      pauseAll(v);
      var audio=v.getAttribute('data-audio-src');
      if(audio&&v.getAttribute('data-mode')!=='audio'){v.setAttribute('data-mode','audio');v.src=audio;v.muted=false}
      else{load(v)}
      v.currentTime=0;v.controls=true;box.classList.add('playing');
      var p=v.play();if(p&&p.catch)p.catch(function(){v.muted=true;v.play&&v.play().catch(function(){})});
    });
  });
  [].forEach.call(document.querySelectorAll('.vid video'),function(v){
    v.addEventListener('ended',function(){var b=v.closest('.vid');if(b&&b.querySelector('[data-play]')){b.classList.remove('playing');v.controls=false}});
  });

  /* sound toggle on hero video */
  var sb=document.getElementById('hero-sound');
  if(sb){
    sb.addEventListener('click',function(){
      var v=document.getElementById('hero-video'),on=sb.getAttribute('aria-pressed')==='true';
      var t=v.currentTime||0;
      if(!on){var a=v.getAttribute('data-audio-src');v.src=a;v.muted=false;v.currentTime=t;sb.textContent='🔊';sb.setAttribute('aria-pressed','true');sb.setAttribute('aria-label','Mute video')}
      else{v.src=v.getAttribute('data-src');v.muted=true;v.currentTime=t;sb.textContent='🔇';sb.setAttribute('aria-pressed','false');sb.setAttribute('aria-label','Play video with sound')}
      var p=v.play();if(p&&p.catch)p.catch(function(){});
    });
  }

  /* sticky mobile bar: after hero, hidden while form in view or an input is focused */
  var bar=document.getElementById('sbar'),hero=document.querySelector('.hero'),enq=document.getElementById('enquiry');
  if(bar&&'IntersectionObserver' in window){
    var st={hero:true,form:false,focus:false};
    function upd(){bar.classList.toggle('show',!st.hero&&!st.form&&!st.focus)}
    if(hero)new IntersectionObserver(function(e){st.hero=e[0].isIntersecting;upd()}).observe(hero);
    if(enq)new IntersectionObserver(function(e){st.form=e[0].isIntersecting;upd()},{threshold:.1}).observe(enq);
    document.addEventListener('focusin',function(e){if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){st.focus=true;upd()}});
    document.addEventListener('focusout',function(){st.focus=false;upd()});
  }
})();
