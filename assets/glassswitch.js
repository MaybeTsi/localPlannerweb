/* WebGL glass knob for the light/dark switch. Written for this project from the technique described on the "How it's made" panel of
   experiments.thisiswhitespace.com/glass-light-toggle (Zsolt Kacso): one fragment shader, a rounded-square glass knob with a bevel, a light strip that hugs
   the glass (bottom at night, top by day) and washes the track, and a pixel-matrix icon where each moon pixel is paired with a sun pixel and the morph
   is scrubbed by the knob position with a per-pixel stagger. No code of that page is used; inspiration and idea credit to the author.
   window.SLGlass.attach(canvas, cssW, cssH) -> {set(p), dispose()} or null when WebGL is unavailable. p: 0 = night (knob left), 1 = day (knob right). */
(function () {
'use strict';
const MOON = ['..XXX....', '.XXX..X..', 'XXX......', 'XXX......', 'XXX......', 'XXXX.....', '.XXXXXXX.', '..XXXXX..'];
const SUN = ['....X....', '.X..X..X.', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '.X..X..X.'];
const flat = a => a.join('').split('').map(c => c === 'X' ? 1 : 0);
const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS = `precision highp float;
uniform vec2 R;uniform float K;uniform float P;uniform float M[72];uniform float S[72];
float sdr(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float hs(float n){return fract(sin(n*91.3+7.1)*43758.5453);}
void main(){
  vec2 c=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y)/K;           // css px, origin top-left
  vec2 box=R/K;vec2 tsz=vec2(62.,34.);vec2 tc=box*.5;          // track 62x34 centred
  float ks=14.;float kx=mix(tc.x-tsz.x*.5+3.+ks,tc.x+tsz.x*.5-3.-ks,P);vec2 kc=vec2(kx,tc.y);
  float dT=sdr(c-tc,tsz*.5,12.);
  float dK=sdr(c-kc,vec2(ks),9.5);
  float ny=(c.y-kc.y)/ks;
  float lit=mix(smoothstep(.15,1.,ny),smoothstep(-.15,-1.,ny),P);   // which side of the glass is lit
  vec3 sc=mix(vec3(.42,.52,1.),vec3(1.,.68,.18),P);                  // strip colour: blue night, amber day
  vec3 col=vec3(0.);float a=0.;
  // light spilling past the track and onto the page
  float ring=exp(-abs(dK-.8)*1.1)*lit;float spill=exp(-max(dK,0.)*.16)*lit*mix(.34,.5,P);
  // track
  vec3 tr=mix(vec3(.04,.045,.07),vec3(.86,.85,.82),P);
  tr*=1.-.35*smoothstep(-8.,0.,dT)*(1.-P*.5);                          // inner edge shadow
  tr+=sc*lit*exp(-max(dK,0.)*.09)*mix(.22,.3,P);                       // strip washes the track
  if(dT<0.){col=tr;a=1.;}
  float ao=smoothstep(1.,-1.,dT);col=mix(col,col,ao);
  float outside=1.-smoothstep(-.5,.5,dT);
  // page glow (outside track and knob)
  float fd=smoothstep(0.,9.,min(min(c.x,box.x-c.x),min(c.y,box.y-c.y)));vec3 gl=sc*(spill+ring*.9)*fd;
  col=mix(gl,col,outside);a=max(outside,clamp(spill*.9+ring*.5,0.,1.)*fd*(1.-outside));
  // knob shadow
  float sh=exp(-max(sdr(c-kc-vec2(0.,3.),vec2(ks),9.5),0.)*.25)*.35*(1.-P*.55);
  if(dK>0.&&dT<0.)col*=1.-sh;
  // glass knob
  if(dK<0.){
    vec3 base=mix(vec3(.17,.18,.23),vec3(.96,.94,.9),P);
    float topSheen=smoothstep(-.4,-1.,ny)*mix(.12,.2,1.-P);
    base+=topSheen;
    base=mix(base,sc,lit*lit*mix(.62,.7,P)*smoothstep(-ks,ks,ny*ks));
    float bev=smoothstep(-3.2,0.,dK);base+=bev*mix(.2,.35,P)*(.5+.5*lit);   // bevel catches light
    base=mix(base,vec3(1.),smoothstep(-1.,0.,dK)*.28*lit);                // bright rim on the lit edge
    // pixel matrix behind the glass
    float cell=14.*1.5/9.;vec2 g=(c-kc)/cell+vec2(4.5,4.);vec2 gi=floor(g),gf=fract(g);
    if(gi.x>=0.&&gi.x<9.&&gi.y>=0.&&gi.y<8.){
      float idx=gi.y*9.+gi.x,mm=0.,ss=0.;
      for(int i=0;i<72;i++){if(abs(float(i)-idx)<.5){mm=M[i];ss=S[i];}}
      float t=clamp(P*1.7-hs(idx)*.7,0.,1.);t=t*t*(3.-2.*t);
      float on=mix(mm,ss,t);
      float sq=step(.1,gf.x)*step(gf.x,.9)*step(.1,gf.y)*step(gf.y,.9);
      vec3 ic=mix(vec3(1.),vec3(.27,.24,.2),t);
      base=mix(base,ic,on*sq*.96);
    }
    col=base;a=1.;
  }
  gl_FragColor=vec4(col*a,a);
}`;
function attach(cv, w, h) {
  const gl = cv.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: true}); if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS); if (!v || !f) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; gl.viewport(0, 0, cv.width, cv.height);
  gl.uniform2f(U('R'), cv.width, cv.height); gl.uniform1f(U('K'), dpr); gl.uniform1fv(U('M'), flat(MOON)); gl.uniform1fv(U('S'), flat(SUN));
  const pu = U('P'); gl.clearColor(0, 0, 0, 0);
  return {set(p) { gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(pu, p); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
          dispose() { const x = gl.getExtension('WEBGL_lose_context'); x && x.loseContext(); }};
}
window.SLGlass = {attach};
})();
