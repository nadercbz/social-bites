/* Konzept Dateien im Portal: Dateiliste, Vorschau, Einzel Download und ZIP.
   Die Dateien liegen verschlüsselt (SBP1, AES-256-GCM) unter konzepte/<id>/, gebaut von build_konzept_dateien.py.
   Schlüssel: PBKDF2 (SHA-256, 600000 Runden, Salt SocialBites-Pitch-v1) aus der Passphrase, dieselbe wie im Akquise Board. */
(function(){
  var SALT="SocialBites-Pitch-v1",RUNDEN=600000;
  var S={id:"",name:"",key:null,man:null,cur:null,urls:[],cache:{}};
  var el=null;

  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function mb(n){return n>=1048576?(n/1048576).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(n/1024))+" KB";}
  function getPw(){try{return sessionStorage.getItem("akq-pw")||localStorage.getItem("akq-pw")||"";}catch(e){return "";}}
  function setPw(p){try{sessionStorage.setItem("akq-pw",p);}catch(e){}}
  function deriveKey(pw){
    return crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]).then(function(km){
      return crypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode(SALT),iterations:RUNDEN,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);});
  }
  function dec(buf){
    var b=new Uint8Array(buf);
    if(String.fromCharCode(b[0],b[1],b[2],b[3])!=="SBP1")return Promise.reject(new Error("Unbekanntes Dateiformat"));
    return crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(4,16)},S.key,b.slice(16)).then(function(x){return new Uint8Array(x);});
  }
  function hol(fid){
    return fetch("konzepte/"+S.id+"/"+fid+".enc").then(function(r){if(!r.ok)throw new Error("Datei fehlt auf dem Server");return r.arrayBuffer();}).then(dec);
  }
  function bytes(f){
    if(S.cache[f.id])return Promise.resolve(S.cache[f.id]);
    return hol(f.id).then(function(b){if(b.length<30e6)S.cache[f.id]=b;return b;});
  }
  function saveBlob(name,blob){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},2000);}

  /* ---------- Markdown, klein ---------- */
  function inl(t){
    t=esc(t);
    t=t.replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/~~([^~]+)~~/g,"<s>$1</s>")
       .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g,"$1<i>$2</i>")
       .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
       .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1");
    return t;
  }
  function md(src){
    var L=src.replace(/\r/g,"").split("\n"),o=[],i=0;
    function cells(l){return l.trim().replace(/^\||\|$/g,"").split("|").map(function(c){return c.trim();});}
    while(i<L.length){
      var l=L[i],m;
      if(/^```/.test(l)){var c=[];i++;while(i<L.length&&!/^```/.test(L[i])){c.push(L[i]);i++;}i++;o.push("<pre>"+esc(c.join("\n"))+"</pre>");continue;}
      if((m=l.match(/^(#{1,6})\s+(.*)$/))){var n=m[1].length;o.push("<h"+n+">"+inl(m[2])+"</h"+n+">");i++;continue;}
      if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){o.push("<hr>");i++;continue;}
      if(/^\s*\|/.test(l)&&i+1<L.length&&/^\s*\|?\s*:?-{2,}/.test(L[i+1])){
        var h=cells(l);i+=2;var rows=[];
        while(i<L.length&&/^\s*\|/.test(L[i])){rows.push(cells(L[i]));i++;}
        o.push('<div class="kzf-tw"><table><thead><tr>'+h.map(function(x){return "<th>"+inl(x)+"</th>";}).join("")+"</tr></thead><tbody>"+rows.map(function(r){return "<tr>"+r.map(function(x){return "<td>"+inl(x)+"</td>";}).join("")+"</tr>";}).join("")+"</tbody></table></div>");continue;
      }
      if(/^\s*>/.test(l)){var q=[];while(i<L.length&&/^\s*>/.test(L[i])){q.push(L[i].replace(/^\s*>\s?/,""));i++;}o.push("<blockquote>"+inl(q.join(" "))+"</blockquote>");continue;}
      if(/^\s*([-*]|\d+\.)\s+/.test(l)){
        var ord=/^\s*\d+\./.test(l),it=[];
        while(i<L.length&&/^\s*([-*]|\d+\.)\s+/.test(L[i])){
          var ind=L[i].match(/^\s*/)[0].length;
          it.push('<li style="margin-left:'+Math.min(ind,12)*8+'px">'+inl(L[i].replace(/^\s*([-*]|\d+\.)\s+/,""))+"</li>");i++;
        }
        o.push((ord?"<ol>":"<ul>")+it.join("")+(ord?"</ol>":"</ul>"));continue;
      }
      if(/^\s*$/.test(l)){i++;continue;}
      var p=[l];i++;
      while(i<L.length&&!/^\s*$/.test(L[i])&&!/^(#{1,6}\s|```|\s*\||\s*>|\s*([-*]|\d+\.)\s)/.test(L[i])){p.push(L[i]);i++;}
      o.push("<p>"+inl(p.join(" "))+"</p>");
    }
    return o.join("\n");
  }

  /* ---------- ZIP (ohne Kompression, reicht für PDF, JPG, MP4) ---------- */
  var CT=null;
  function crc32(b){
    if(!CT){CT=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CT[n]=c>>>0;}}
    var c2=0xFFFFFFFF;for(var i=0;i<b.length;i++)c2=CT[(c2^b[i])&255]^(c2>>>8);return (c2^0xFFFFFFFF)>>>0;
  }
  function u16(v){return new Uint8Array([v&255,(v>>8)&255]);}
  function u32(v){return new Uint8Array([v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255]);}
  function dosTime(){var d=new Date();return {t:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),d:((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
  function zipBlob(entries){
    var parts=[],central=[],off=0,dt=dosTime(),enc=new TextEncoder();
    entries.forEach(function(e){
      var nm=enc.encode(e.name),crc=crc32(e.data),sz=e.data.length;
      var head=[u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(dt.t),u16(dt.d),u32(crc),u32(sz),u32(sz),u16(nm.length),u16(0),nm];
      var hl=30+nm.length;
      parts.push.apply(parts,head);parts.push(e.data);
      central.push([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(dt.t),u16(dt.d),u32(crc),u32(sz),u32(sz),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nm]);
      off+=hl+sz;
    });
    var cs=0;
    central.forEach(function(c){c.forEach(function(x){parts.push(x);cs+=x.length;});});
    [u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(cs),u32(off),u16(0)].forEach(function(x){parts.push(x);});
    return new Blob(parts,{type:"application/zip"});
  }
  function zipLaden(liste,dateiname,btn){
    var st=el.querySelector(".kzf-st"),ents=[],i=0;
    btn&&(btn.disabled=true);
    function next(){
      if(i>=liste.length){
        st.textContent="ZIP wird gebaut …";
        setTimeout(function(){
          var blob=zipBlob(ents);saveBlob(dateiname,blob);
          st.textContent="ZIP geladen: "+liste.length+" Dateien, "+mb(blob.size);btn&&(btn.disabled=false);
        },30);return Promise.resolve();
      }
      var f=liste[i];st.textContent="Entschlüssele "+(i+1)+" von "+liste.length+": "+f.name;
      return bytes(f).then(function(b){ents.push({name:S.name.replace(/[\\\/]/g,"_")+"/"+f.pfad,data:b});i++;return new Promise(function(r){setTimeout(r,0);});}).then(next);
    }
    return next().catch(function(e){st.textContent="ZIP ging nicht: "+e.message;btn&&(btn.disabled=false);});
  }

  /* ---------- Oberfläche ---------- */
  var CSS='.kzf{position:fixed;inset:0;z-index:9000;background:var(--paper);color:var(--ink);display:flex;flex-direction:column;font-family:var(--display)}'+
  '.kzf *{box-sizing:border-box}'+
  '.kzf-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px var(--gutter);border-bottom:1px solid var(--line);background:var(--card)}'+
  '.kzf-top h2{margin:0;font-size:20px;letter-spacing:-.03em;flex:1;min-width:140px}'+
  '.kzf-top h2 small{display:block;font:500 12px var(--mono);color:var(--mute);letter-spacing:0;margin-top:2px}'+
  '.kzf-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(260px,340px) 1fr}'+
  '.kzf-side{border-right:1px solid var(--line);overflow:auto;background:var(--card);padding:10px 10px 30px}'+
  '.kzf-side input[type=search]{width:100%;padding:10px 12px;border:1px solid var(--line-2);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit;font-size:14px;margin-bottom:8px}'+
  '.kzf-cat{margin:12px 4px 4px;display:flex;align-items:center;gap:8px;font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent-ink)}'+
  '.kzf-cat span{flex:1}'+
  '.kzf-cat button{border:0;background:var(--accent-tint);color:var(--accent-ink);font:600 10.5px var(--mono);border-radius:999px;padding:3px 9px;cursor:pointer}'+
  '.kzf-row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:var(--ink);padding:8px;border-radius:10px;cursor:pointer;font:inherit}'+
  '.kzf-row:hover{background:var(--paper-2)}.kzf-row.on{background:var(--accent-tint)}'+
  '.kzf-row b{display:block;font-weight:600;font-size:14px;word-break:break-word}'+
  '.kzf-row small{display:block;color:var(--mute);font-size:12px}'+
  '.kzf-ic{flex:none;width:34px;height:34px;border-radius:8px;background:var(--paper-2);display:grid;place-items:center;font:700 10px var(--mono);color:var(--accent-ink);overflow:hidden}'+
  '.kzf-view{overflow:auto;padding:var(--gutter);display:flex;flex-direction:column;gap:14px;min-width:0}'+
  '.kzf-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'+
  '.kzf-bar h3{margin:0;font-size:18px;letter-spacing:-.02em;flex:1;min-width:160px;word-break:break-word}'+
  '.kzf-bar small{display:block;font:500 12px var(--mono);color:var(--mute)}'+
  '.kzf-box{flex:1;min-height:320px;border:1px solid var(--line);border-radius:14px;background:var(--card);overflow:auto;display:grid;place-items:center}'+
  '.kzf-box>img,.kzf-box>video{max-width:100%;max-height:100%;display:block}'+
  '.kzf-box>iframe{width:100%;height:100%;border:0;min-height:60vh}'+
  '.kzf-box.txt{display:block;padding:clamp(16px,3vw,36px)}'+
  '.kzf-md{max-width:860px;margin:0 auto;font-size:15.5px;line-height:1.6}'+
  '.kzf-md h1{font-size:30px;letter-spacing:-.03em;margin:.2em 0 .5em}.kzf-md h2{font-size:23px;letter-spacing:-.02em;margin:1.6em 0 .5em}.kzf-md h3{font-size:18px;margin:1.4em 0 .4em}.kzf-md h4{font-size:15px;margin:1.2em 0 .3em}'+
  '.kzf-md p{margin:.6em 0}.kzf-md ul,.kzf-md ol{padding-left:1.3em;margin:.6em 0}.kzf-md li{margin:.25em 0}'+
  '.kzf-md code{font:13px var(--mono);background:var(--paper-2);padding:1px 5px;border-radius:5px}.kzf-md pre{background:var(--paper-2);padding:14px;border-radius:10px;overflow:auto;font:13px var(--mono)}'+
  '.kzf-md blockquote{margin:.8em 0;padding:8px 14px;border-left:3px solid var(--accent);background:var(--accent-tint);border-radius:0 10px 10px 0}'+
  '.kzf-md hr{border:0;border-top:1px solid var(--line);margin:1.6em 0}.kzf-md a{color:var(--accent-ink)}'+
  '.kzf-tw{overflow:auto;margin:.8em 0}.kzf-md table{border-collapse:collapse;font-size:13.5px;min-width:100%}.kzf-md th,.kzf-md td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}.kzf-md th{background:var(--paper-2)}'+
  '.kzf-st{font:500 12px var(--mono);color:var(--mute);padding:6px var(--gutter);border-top:1px solid var(--line);background:var(--card);min-height:30px}'+
  '.kzf-lock{margin:auto;max-width:420px;padding:26px;border:1px solid var(--line);border-radius:16px;background:var(--card);display:grid;gap:12px}'+
  '.kzf-lock h3{margin:0;font-size:22px}.kzf-lock p{margin:0;color:var(--mute);font-size:14px}'+
  '.kzf-lock input{padding:11px 12px;border:1px solid var(--line-2);border-radius:10px;font:inherit;background:var(--paper);color:var(--ink)}'+
  '.kzf-err{color:#b3261e;font-size:13px;min-height:18px}'+
  '.kzf-empty{margin:auto;color:var(--mute);text-align:center;max-width:360px;font-size:15px;line-height:1.5}'+
  '@media(max-width:820px){.kzf-main{grid-template-columns:1fr;grid-template-rows:minmax(150px,38%) 1fr}.kzf-side{border-right:0;border-bottom:1px solid var(--line)}}';

  function btn(cls,txt,attr){return '<button class="btn sm '+(cls||"")+'" type="button" '+(attr||"")+'><span class="dot"></span><span>'+txt+'</span></button>';}
  function ext(f){var m=f.name.match(/\.([a-z0-9]+)$/i);return m?m[1].slice(0,4).toUpperCase():"";}

  function shell(){
    if(!document.getElementById("kzf-css")){var s=document.createElement("style");s.id="kzf-css";s.textContent=CSS;document.head.appendChild(s);}
    el=document.createElement("div");el.className="kzf";el.setAttribute("role","dialog");el.setAttribute("aria-label","Konzept Dateien");
    el.innerHTML='<div class="kzf-top"><h2></h2><span class="kzf-acts"></span></div><div class="kzf-main"></div><div class="kzf-st"></div>';
    document.body.appendChild(el);document.body.style.overflow="hidden";
    document.addEventListener("keydown",esc_);
  }
  function esc_(e){if(e.key==="Escape"&&el)close();}
  function close(){
    S.urls.forEach(function(u){URL.revokeObjectURL(u);});S.urls=[];S.cache={};
    document.removeEventListener("keydown",esc_);
    if(el){el.remove();el=null;}document.body.style.overflow="";
  }

  function lock(msg){
    var main=el.querySelector(".kzf-main");
    main.innerHTML='<form class="kzf-lock"><h3>Passphrase eingeben</h3><p>Die Unterlagen liegen verschlüsselt auf dem Server. Es ist dieselbe Passphrase wie im Akquise Board.</p><input type="password" name="pw" autocomplete="current-password" placeholder="Passphrase" required><div class="kzf-err">'+esc(msg||"")+'</div>'+btn("inv","Öffnen",'type="submit"').replace('type="button" type="submit"','type="submit"')+'</form>';
    var f=main.querySelector("form");f.pw.focus();
    f.addEventListener("submit",function(e){e.preventDefault();var pw=f.pw.value;if(!pw)return;entsperren(pw);});
  }
  function entsperren(pw){
    var st=el.querySelector(".kzf-st");st.textContent="Prüfe Passphrase, das dauert einen Moment …";
    return deriveKey(pw).then(function(k){S.key=k;return fetch("konzepte/"+S.id+"/index.enc").then(function(r){if(!r.ok)throw new Error("Dateiliste fehlt auf dem Server");return r.arrayBuffer();}).then(dec);})
      .then(function(b){S.man=JSON.parse(new TextDecoder().decode(b));setPw(pw);st.textContent="";zeigen();})
      .catch(function(e){S.key=null;st.textContent="";lock(e&&e.name==="OperationError"?"Passphrase stimmt nicht.":("Ging nicht: "+(e&&e.message||e)));});
  }

  function zeigen(){
    var d=S.man.dateien,total=d.reduce(function(a,f){return a+f.groesse;},0);
    el.querySelector(".kzf-top h2").innerHTML=esc(S.name)+' <small>'+d.length+' Dateien, '+mb(total)+', Stand '+esc(S.man.stand.split("-").reverse().join("."))+'</small>';
    el.querySelector(".kzf-acts").innerHTML=btn("inv","Alles als ZIP laden",'data-a="zip"')+" "+btn("","Schließen",'data-a="close"');
    el.querySelector(".kzf-main").innerHTML='<div class="kzf-side"><input type="search" placeholder="Datei suchen" aria-label="Datei suchen"><div class="kzf-list"></div></div><div class="kzf-view"><div class="kzf-empty">Links eine Datei anklicken. PDFs, Bilder, Videos und Texte öffnen sich direkt hier, alles lässt sich einzeln oder als ZIP herunterladen.</div></div>';
    liste("");
    el.querySelector("input[type=search]").addEventListener("input",function(e){liste(e.target.value);});
    var first=d.filter(function(f){return /UEBERSICHT/.test(f.name);})[0];if(first)oeffnen(first);
  }
  function liste(q){
    q=(q||"").toLowerCase().trim();
    var out="",last="";
    S.man.dateien.forEach(function(f){
      if(q&&(f.name+" "+f.kat+" "+f.info).toLowerCase().indexOf(q)<0)return;
      if(f.kat!==last){last=f.kat;out+='<div class="kzf-cat"><span>'+esc(f.kat)+'</span><button type="button" data-a="katzip" data-k="'+esc(f.kat)+'" title="Diesen Ordner als ZIP laden">ZIP</button></div>';}
      out+='<button class="kzf-row'+(S.cur&&S.cur.id===f.id?" on":"")+'" type="button" data-a="open" data-id="'+f.id+'"><span class="kzf-ic">'+(/^image\//.test(f.mime)?"IMG":ext(f))+'</span><span><b>'+esc(f.name)+'</b><small>'+mb(f.groesse)+(f.info?" · "+esc(f.info):"")+'</small></span></button>';
    });
    el.querySelector(".kzf-list").innerHTML=out||'<p class="kzf-empty" style="margin:30px 6px">Nichts gefunden.</p>';
  }
  function oeffnen(f){
    S.cur=f;
    el.querySelectorAll(".kzf-row").forEach(function(r){r.classList.toggle("on",r.getAttribute("data-id")===f.id);});
    var v=el.querySelector(".kzf-view"),st=el.querySelector(".kzf-st");
    v.innerHTML='<div class="kzf-bar"><h3>'+esc(f.name)+'<small>'+esc(f.pfad)+' · '+mb(f.groesse)+'</small></h3>'+btn("inv","Herunterladen",'data-a="dl"')+'</div><div class="kzf-box"><span class="kzf-empty">Lädt …</span></div>';
    st.textContent="Entschlüssele "+f.name+" …";
    bytes(f).then(function(b){
      if(S.cur!==f)return;
      var box=v.querySelector(".kzf-box");st.textContent="";
      if(f.mime==="text/markdown"){box.className="kzf-box txt";box.innerHTML='<div class="kzf-md">'+md(new TextDecoder().decode(b))+'</div>';return;}
      var u=URL.createObjectURL(new Blob([b],{type:f.mime}));S.urls.push(u);
      if(/^image\//.test(f.mime))box.innerHTML='<img alt="'+esc(f.name)+'" src="'+u+'">';
      else if(f.mime==="application/pdf"){box.innerHTML='<iframe title="'+esc(f.name)+'" src="'+u+'"></iframe>';var bar=v.querySelector(".kzf-bar");if(bar)bar.insertAdjacentHTML("beforeend",'<a class="btn sm" href="'+u+'" target="_blank" rel="noopener"><span class="dot"></span><span>In neuem Tab öffnen</span></a>');}
      else if(/^video\//.test(f.mime))box.innerHTML='<video controls playsinline src="'+u+'"></video>';
      else box.innerHTML='<div class="kzf-empty">Für dieses Format gibt es keine Vorschau ('+esc(ext(f))+'). Mit „Herunterladen“ in Excel oder dem passenden Programm öffnen.</div>';
    }).catch(function(e){st.textContent="Ging nicht: "+e.message;});
  }

  function onClick(e){
    var b=e.target.closest("[data-a]");if(!b||!el||!el.contains(b))return;
    var a=b.getAttribute("data-a");
    if(a==="close")return close();
    if(a==="open"){var f=S.man.dateien.filter(function(x){return x.id===b.getAttribute("data-id");})[0];if(f)oeffnen(f);return;}
    if(a==="dl"&&S.cur){var c=S.cur;el.querySelector(".kzf-st").textContent="Entschlüssele …";bytes(c).then(function(x){saveBlob(c.name,new Blob([x],{type:c.mime}));el.querySelector(".kzf-st").textContent=c.name+" geladen";});return;}
    if(a==="zip")return zipLaden(S.man.dateien,S.name.replace(/\s+/g,"_")+"_komplett.zip",b);
    if(a==="katzip"){var k=b.getAttribute("data-k");return zipLaden(S.man.dateien.filter(function(x){return x.kat===k;}),S.name.replace(/\s+/g,"_")+"_"+k.replace(/[^\wäöüÄÖÜß]+/g,"_")+".zip",b);}
  }

  window.KzFiles={open:function(id,name){
    if(el)close();
    S={id:id,name:name||id,key:null,man:null,cur:null,urls:[],cache:{}};
    if(!(window.crypto&&crypto.subtle&&window.TextEncoder)){alert("Dieser Browser kann die Dateien nicht entschlüsseln (Verschlüsselung braucht https oder localhost).");return;}
    shell();el.addEventListener("click",onClick);
    var pw=getPw();if(pw)entsperren(pw);else lock("");
  }};
})();
