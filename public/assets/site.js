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

  /* ---------- videos ---------- */
  function setSrc(v,url){if(url&&v.getAttribute('src')!==url)v.src=url}
  /* Safari throws if currentTime is set before metadata is loaded, so defer the seek */
  function seek(v,t){
    if(!t)return;
    var go=function(){try{v.currentTime=t}catch(e){}};
    if(v.readyState>=1)go();else v.addEventListener('loadedmetadata',go,{once:true});
  }

  /* Hero: autoplay muted when in view, play ONCE, hold the final frame.
     If the browser blocks autoplay (e.g. iOS Low Power Mode) or the user prefers reduced motion / data saver,
     a visible Play button is shown instead. */
  var hv=document.getElementById('hero-video');
  if(hv){
    var hbox=hv.closest('.vid'),hplay=document.getElementById('hero-play'),hrep=document.getElementById('hero-replay'),wd=null,done=false;
    hv.muted=true;hv.defaultMuted=true;hv.playsInline=true;hv.loop=false;hv.removeAttribute('loop');
    var block=function(){hbox.classList.add('blocked')};
    var unblock=function(){hbox.classList.remove('blocked')};
    var attempt=function(){
      if(done)return;
      setSrc(hv,hv.getAttribute('data-src'));hv.preload='auto';
      var p;try{p=hv.play()}catch(e){block();return}
      if(p&&p.catch)p.catch(block);
      clearTimeout(wd);wd=setTimeout(function(){if(hv.paused&&!done)block()},1800);
    };
    hv.addEventListener('playing',function(){clearTimeout(wd);unblock();hbox.classList.remove('done')});
    hv.addEventListener('ended',function(){done=true;clearTimeout(wd);unblock();hbox.classList.add('done')}); /* final frame stays on screen */
    hv.addEventListener('error',block);
    var manual=function(){ /* user gesture: always allowed to play */
      done=false;hbox.classList.remove('done');unblock();
      setSrc(hv,hv.getAttribute('data-src'));
      var p;try{p=hv.play()}catch(e){block();return}
      if(p&&p.catch)p.catch(block);
    };
    if(hplay)hplay.addEventListener('click',manual);
    if(hrep)hrep.addEventListener('click',manual);
    if(calm){block()}
    else if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        es.forEach(function(en){
          if(en.isIntersecting)attempt();
          else if(!hv.paused)hv.pause();
        });
      },{threshold:.35}).observe(hv);
    }else{attempt()}

    /* sound toggle (user gesture) */
    var sb=document.getElementById('hero-sound');
    if(sb)sb.addEventListener('click',function(){
      var on=sb.getAttribute('aria-pressed')==='true',t=hv.ended?0:(hv.currentTime||0);
      if(!on){setSrc(hv,hv.getAttribute('data-audio-src'));hv.muted=false;sb.textContent='\uD83D\uDD0A';sb.setAttribute('aria-pressed','true');sb.setAttribute('aria-label','Mute video')}
      else{setSrc(hv,hv.getAttribute('data-src'));hv.muted=true;sb.textContent='\uD83D\uDD07';sb.setAttribute('aria-pressed','false');sb.setAttribute('aria-label','Play video with sound')}
      seek(hv,t);done=false;hbox.classList.remove('done');unblock();
      var p;try{p=hv.play()}catch(e){block();return}
      if(p&&p.catch)p.catch(block);
    });
  }

  /* Gallery: tap to play (with sound where an audio version exists) */
  function pauseOthers(except){
    [].forEach.call(document.querySelectorAll('.vid video'),function(v){if(v===except)return;if(!v.paused)v.pause();var b=v.closest('.vid');if(b&&b.querySelector('[data-play]')){b.classList.remove('playing');v.controls=false}});
  }
  [].forEach.call(document.querySelectorAll('[data-play]'),function(btn){
    var box=btn.closest('.vid'),v=box.querySelector('video');
    v.addEventListener('ended',function(){box.classList.remove('playing');v.controls=false});
    v.addEventListener('error',function(){box.classList.remove('playing');v.controls=false});
    btn.addEventListener('click',function(){
      pauseOthers(v);
      var audio=v.getAttribute('data-audio-src');
      if(audio){setSrc(v,audio);v.muted=false}else{setSrc(v,v.getAttribute('data-src'));v.muted=false}
      v.playsInline=true;v.controls=true;box.classList.add('playing');
      var p;try{p=v.play()}catch(e){p=null}
      if(p&&p.catch)p.catch(function(){ /* sound refused: retry muted, else show the button again */
        v.muted=true;var q;try{q=v.play()}catch(e){q=null}
        if(q&&q.catch)q.catch(function(){box.classList.remove('playing');v.controls=false});
      });
    });
  });

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
