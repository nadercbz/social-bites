/* Konzept Reihenfolge im Portal (Kreativ, Konzept Reihenfolge): alle Steps untereinander, jeder Step klappt auf und zeigt den Prompt.
   Die Daten liegen verschlüsselt (SBP1, AES-256-GCM) unter konzepte/reihenfolge/data.enc, gebaut mit Konzepte/_Werkzeuge/reihenfolge.py --portal.
   Schlüssel wie bei den Konzept Dateien: PBKDF2 (SHA-256, 600000 Runden, Salt SocialBites-Pitch-v1) aus der Passphrase des Akquise Boards. */
(function(){
  var SALT="SocialBites-Pitch-v1",RUNDEN=600000,DATA=null;
  var LABEL={neu:"Offen",teil:"Teils da",da:"Entwurf da",fertig:"Fertig",finale:"Finale"};
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function getPw(){try{return sessionStorage.getItem("akq-pw")||localStorage.getItem("akq-pw")||"";}catch(e){return "";}}
  function setPw(p){try{sessionStorage.setItem("akq-pw",p);}catch(e){}}
  function holen(pw){
    return crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]).then(function(km){
      return crypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode(SALT),iterations:RUNDEN,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
    }).then(function(key){
      return fetch("konzepte/reihenfolge/data.enc").then(function(r){if(!r.ok)throw new Error("Daten fehlen auf dem Server");return r.arrayBuffer();}).then(function(buf){
        var b=new Uint8Array(buf);
        if(String.fromCharCode(b[0],b[1],b[2],b[3])!=="SBP1")throw new Error("Unbekanntes Dateiformat");
        return crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(4,16)},key,b.slice(16));
      });
    }).then(function(x){return JSON.parse(new TextDecoder().decode(x));});
  }

  var CSS='.rf{margin-top:18px;max-width:980px}.rf-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px}'+
    '.rf-pill{border:1.5px solid var(--ink);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 14px;font:600 14px var(--display);cursor:pointer}.rf-pill[aria-pressed=true]{background:var(--ink);color:var(--paper)}'+
    '.rf-sum{font-size:14px;opacity:.75;margin:10px 0 0}.rf-ph{margin:34px 0 4px;font-size:26px;font-weight:700;letter-spacing:-.02em}.rf-sub{font-size:14px;opacity:.65;margin:0 0 12px}'+
    '.rf-s{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:10px}.rf-s>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:14px;padding:14px 16px}.rf-s>summary::-webkit-details-marker{display:none}'+
    '.rf-n{font-family:var(--mono);font-weight:700;font-size:15px;min-width:30px;color:var(--c,var(--accent-ink))}.rf-t{font-weight:650;font-size:17px;flex:1}'+
    '.rf-ch{font:600 11px var(--mono);letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:5px 10px;background:var(--paper-2)}.rf-ch.fertig{background:#9BBF6A}.rf-ch.da{background:#DDE9C8}.rf-ch.teil{background:#F7D9CF}.rf-ch.neu{background:var(--accent-tint)}.rf-ch.finale{background:var(--accent);color:var(--ink)}'+
    '.rf-s>summary:after{content:"+";font-size:20px;opacity:.5}.rf-s[open]>summary:after{content:"−"}.rf-b{padding:0 16px 16px 60px}.rf-b p{margin:0 0 10px;font-size:15px;opacity:.85}'+
    '.rf-pr{background:var(--paper-2);border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.55}.rf-pr b{display:block;font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin-bottom:6px}'+
    '.rf-f{margin-top:10px;font-size:13px;opacity:.65}.rf-cp{margin-top:10px}.rf-lock{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;max-width:520px}.rf-lock input{width:100%;margin:10px 0;padding:10px;border:1px solid var(--line-2);border-radius:8px;font:inherit}.rf-err{color:#b3261e;font-size:14px;min-height:20px}'+
    '@media(max-width:700px){.rf-b{padding-left:16px}}';

  function render(host,st){
    var d=DATA,stat=(st.k&&d.status&&d.status[st.k])||null,n=0,cnt={};
    var h='<div class="rf"><div class="rf-bar"><button class="rf-pill" type="button" data-rf="k" data-k="" aria-pressed="'+(!st.k)+'">Allgemein</button>'+
      '<button class="rf-pill" type="button" data-rf="k" data-k="pink-moss" aria-pressed="'+(st.k==="pink-moss")+'">Pink Moss Stand</button>'+
      '<button class="rf-pill" type="button" data-rf="all">Alle aufklappen</button></div>';
    d.phasen.forEach(function(p){p.steps.forEach(function(s){var z=s.s||(stat&&stat[s.n])||"neu";cnt[z]=(cnt[z]||0)+1;});});
    h+='<p class="rf-sum">'+(d.phasen.reduce(function(a,p){return a+p.steps.length;},0))+' Steps, immer einer nach dem anderen, Freigabe durch Nader vor dem nächsten. Ab dem Brandbook ist die Marke eingefroren, das Erklärvideo ist der letzte Baustein.'+(stat?' Stand Pink Moss: '+["fertig","da","teil","neu"].map(function(k){return (cnt[k]||0)+" "+LABEL[k].toLowerCase();}).join(", ")+'.':'')+'</p>';
    d.phasen.forEach(function(p){
      h+='<h2 class="rf-ph" style="color:'+esc(p.farbe)+'">'+esc(p.phase)+'</h2><p class="rf-sub">'+esc(p.sub)+'</p>';
      p.steps.forEach(function(s){
        var z=s.s||(stat&&stat[s.n])||"neu";
        h+='<details class="rf-s" style="--c:'+esc(p.farbe)+'"><summary><span class="rf-n">'+s.n+'</span><span class="rf-t">'+esc(s.t)+'</span>'+(stat||s.s?'<span class="rf-ch '+z+'">'+LABEL[z]+'</span>':'')+'</summary><div class="rf-b"><p>'+esc(s.d)+'</p>'+
          (s.p?'<div class="rf-pr"><b>Prompt</b>'+esc(s.p)+'</div><button class="btn sm rf-cp" type="button" data-rf="cp" data-n="'+s.n+'"><span class="dot"></span><span>Prompt kopieren</span></button>':'')+
          '<div class="rf-f">Dateien: '+esc(s.f)+' · Baustein '+esc(s.b)+'</div></div></details>';
      });
    });
    host.innerHTML=h+'</div>';
  }
  function lock(host,msg,st){
    host.innerHTML='<div class="rf-lock"><b>Passphrase</b><p style="margin:6px 0 0;font-size:14px;opacity:.75">Die Reihenfolge ist verschlüsselt, dieselbe Passphrase wie im Akquise Board.</p><input type="password" autocomplete="current-password" aria-label="Passphrase"><div class="rf-err">'+esc(msg||"")+'</div><button class="btn sm inv" type="button" data-rf="go"><span class="dot"></span><span>Öffnen</span></button></div>';
    var inp=host.querySelector("input");
    function go(){var p=inp.value;if(!p)return;load(host,p,st);}
    host.querySelector('[data-rf="go"]').onclick=go;inp.addEventListener("keydown",function(e){if(e.key==="Enter")go();});inp.focus();
  }
  function load(host,pw,st){
    host.innerHTML='<p class="muted">Entschlüssele …</p>';
    holen(pw).then(function(x){DATA=x;setPw(pw);render(host,st);}).catch(function(){lock(host,"Passphrase stimmt nicht oder die Daten fehlen.",st);});
  }
  window.RfView={mount:function(host){
    if(!document.getElementById("rfCss")){var s=document.createElement("style");s.id="rfCss";s.textContent=CSS;document.head.appendChild(s);}
    var st={k:""};
    if(!(window.crypto&&crypto.subtle&&window.TextEncoder)){host.innerHTML='<p class="muted">Dieser Browser kann die Daten nicht entschlüsseln (Verschlüsselung braucht https oder localhost).</p>';return;}
    host.addEventListener("click",function(e){
      var b=e.target.closest("[data-rf]");if(!b||!DATA)return;var a=b.getAttribute("data-rf");
      if(a==="k"){st.k=b.getAttribute("data-k");render(host,st);}
      else if(a==="all"){var ds=host.querySelectorAll("details.rf-s"),open=Array.prototype.some.call(ds,function(x){return !x.open;});ds.forEach(function(x){x.open=open;});b.querySelector?b.textContent=open?"Alle zuklappen":"Alle aufklappen":0;}
      else if(a==="cp"){var n=+b.getAttribute("data-n"),txt="";DATA.phasen.forEach(function(p){p.steps.forEach(function(s){if(s.n===n)txt=s.t+": "+s.p;});});
        (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){b.querySelector("span:last-child").textContent="Kopiert";}).catch(function(){b.querySelector("span:last-child").textContent="Kopieren nicht möglich";});}
    });
    if(DATA){render(host,st);return;}
    var pw=getPw();if(pw)load(host,pw,st);else lock(host,"",st);
  }};
})();
