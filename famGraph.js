//var curGraph //n'a de sens que si 1 seul graph est visible à la fois.
const elL = 60, elH = 40 //largeur et hauteur des ellipses
var selArr =[]
var selSvgGrp, firstMelforRel, oldFirstMelForRelFill


function initGraphMel(mel) { 
  graphs ??= []
  mel.f ??= 0
  graphs[mel.f] ??=[]
  graphs[mel.f].push(mel)
  mel.f = graphs[mel.f]
}

function initGraph() {  // construit maintenant graphs à partir de mels
  graphs.forEach((g, f) => {
    g.f=f
    //nettoyage des vieux "e"
    if (f) { //ne rien faire avec le graphe 0
      g.forEach(m=>m.rel = m.rel.replaceAll('e','.'))
      //replace les "e" en réciproques de chaque "p") 
      g.forEach((m,i)=> m.rel.split('').forEach((r,j)=>{
        if(r=='p') g[j].rel = g[j].rel.split('').with(i, 'e').join('')
      }))
    }
    makeDTradioBttn('Graph',f, showGraph)
  }
)}

function recycleEmptyGraph(f) {
  graphs[f]=[]
  if (graphs.length == f+1) {
    document.querySelector('#fBt'+f).remove()
    graphs.length--
  }
}

function newEmptyGraph(mList) { //returns new (or recycled) empty group 
  var n = graphs.findIndex((g,i)=>i && g.length==0) //no empty group to recycle
  if (n == -1) {
    n = graphs.length
    makeDTradioBttn('Graph',n, showGraph)
  }
  graphs[n] = mList
  graphs[n].f = n   //(utile même si on avait trouvé un graphe vide)
  graphs[n].forEach(m=>m.f = graphs[n])
  return graphs[n]
}

function refreshGraphPanelForMel(m) { //3 cas selon m : null, 0, ou ...
 var postedFam = $('#GraphPanel').attr("dt_label") //ce qui est déjà dessiné
 fam = m == null ? null : mels[m].f.f //changer (ou fermer) le graphe affiché:
 if (fam != postedFam) {
   if (fam) showGraph(fam) //il n'affiche le graphe 0 que s'il est déjà affiché
   else {
    $('#BtGraph'+postedFam).css("backgroundColor","gainsboro")  //nettoyage bouton
    $('#GraphPanel').attr('dt_label', null).empty().height("0px") 
   }
 }
 if ($('#GraphPanel').height()) {  //si le panneau est visible (donc sur la bonne famille déjà)
   $('#GraphPanel g ellipse').css("stroke-width", "1px" )        // "déhighligther" l'ancienne méllipse
   $('#GraphPanel g#m'+m+' ellipse').css("stroke-width", "3px" ) // "highligther" la nouvelle méllipse
 }
}

function showGraph(f) {   //f est un n°de famille (ou "null", pour fermer le panel)
  $('#DTGraphBttns button').css("backgroundColor","gainsboro")  //reset (massif) du bouton précédent
  $('#BtGraph'+f).css("background-color","lightgreen") 
  $('#GraphPanel').empty().attr("dt_label",f)
  if (f == null) return
  var g = graphs[f]
  if (f==0) {  
    //On "range les méls du graphe [0] dans un carré de "units" d'ellipses de côté
    var units = Math.round(Math.sqrt(g.length))
    g.forEach((m,i)=>{
      m.X = (elL+10)*(i%units)
      m.Y = (elH+10)*Math.floor(i/units)
      m.rel = "m"
  })} 

  var minX = g.reduce((min, m) => Math.min(m.X, min), 10000) - elL
  var minY = g.reduce((min, m) => Math.min(m.Y, min), 10000) - elH
  g.forEach(m => {m.X-=minX; m.Y-=minY})
  var graphWidth = elL + g.reduce((max, m) => Math.max(m.X, max), 0)
  var graphHeigth = elH + g.reduce((max, m) => Math.max(m.Y, max), 0)
  $('#GraphPanel')
    .width(graphWidth)
    .height(graphHeigth)
    .attr("dt_label",f)
  g.ppr = SVG().addTo('#GraphPanel')

  g.forEach((m,i) => {   //on dessine chaque mélodie, et créé/renseigne l'attribut m.shape                                                    
    var group = g.ppr.group()
    group.id ("m"+m.mel)  //**************ça sert où à part l'inspecteur? // double l'info de g.text
    //group.class ("melodie")
    group.ellipse(elL, elH).stroke({color: '#000',width : 1}).fill(m.rel.includes("p") ? "#d4e1f5" : "#FFF2CC"), // bleu, jaune 
    group.text(m.mel).font('size', 10).center(elL/2, elH/3)
    var rsRef = mels[m.mel]?.docs?.find(d=>d.ref.startsWith('RS'))?.ref
    if (rsRef) group.text(rsRef).font('size', 9).center(elL/2, elH*2/3)
    m.shapes = group.move(m.X, m.Y)
  })
  drawGraphArrows()
  selSvgGrp = g.ppr.group()
  g.forEach((m, i) => {    //***********************FSA d'interaction sur les ellipses: 
    m.shapes.first().on('click', $('#editeur')[0].checked ? e=>defaultEditorsClick(e) :  e=>toggleMel(e))

    function defaultEditorsClick(e) {
      if (e.shiftKey && e.metaKey) return console.log('ignored "shift + meta" click')
      if (e.shiftKey) {  //on veut draguer (1 mél ou +, à voir)
        if(selArr.length ==0 ) $('#AudPanel')[0].pause()  //on fait silence pour l'édition!
        if(selArr.includes(m)) unselectFromDrag(m)   //il shift-key 2 fois la même mélodie: on l'enlève
        else  selectForDrag(m)    // cette mélodie n'est pas déjà dans le groupe de drague
      }    
      else {// no shift key 
        if (selArr.length)  unselectAllFromDrag(e)
        else if (e.metaKey) {  //on ajoute une relation
            if (firstMelforRel) {  //on vient de sélectionner la 2e mélodie
              if (firstMelforRel!=m) {
                showGraph(createRelation(firstMelforRel, m))
                edited()
              }
              unselectFromRel(e)
            } else {
              firstMelforRel=m
              oldFirstMelForRelFill= m.shapes.first().fill()
              m.shapes.first().fill('#00ff00')
              //console.log(`Sélectionner une autre mélodie à relier à m${m.mel}`)
            }
          } else if (firstMelforRel) unselectFromRel(e)
                 else                toggleMel(e)
      }
    }

    function toggleMel(e) {    // comparer à playAV(s, doc) 
      var m=e.rangeParent.id.substring(1)
      if(m == $('#MelPanel').attr('dt_label')) {
        if ((audio = $("#AudPanel")).attr("mel") == m) audio[0].paused ? audio[0].play() : audio[0].pause()
      } else showMelPanel(m)
    }

    function unselectFromRel(e) {
      firstMelforRel.shapes.first().fill(oldFirstMelForRelFill)
      firstMelforRel = undefined
      defaultBehaviour()
    }
    
    function moveArrows() {
      g.arrows.filter(c=> c.from==i || c.to ==i).forEach(c =>     //redessine les flèches concernées
        c.line.plot(elliPath(g[c.from].shapes.first(), g[c.to].shapes.first()))
    )}

    function defaultBehaviour() {
      m.shapes.first()    
      .click(e=>toggleMel(e))
      .touchstart(e=>toggleMel(e))
    }
    function selectForDrag(m) { 
      selArr.push(m)            
      //m.shapes.first().stroke({width:5})
      m.shapes.first().css("stroke-width", "5px")
      selSvgGrp.add(m.shapes)
      selSvgGrp.draggable()
        .on('dragmove', ()=> moveArrows())
        .on('dragend' , ()=> { 
          moveArrows()
          selArr.forEach(m=>{
            [m.X, m.Y] = [m.shapes.first().x(), m.shapes.first().y()]
            m.shapes.click(unselectFromDrag(m))
          })
          edited()
        })
    }
    function unselectAllFromDrag() { 
      if (selArr.length==0) return    
      selSvgGrp.draggable(false)//on arrête le groupe : faut enregistrer
      selSvgGrp.off()
      selArr.forEach(m=>unselectFromDrag(m))
      selArr =[]  //useless?
      m.shapes.first().on('click', e=>defaultEditorsClick(e))
    }
    function unselectFromDrag(m) { 
      g.ppr.add(m.shapes)
      m.shapes.first().stroke({width:1})
      selArr = selArr.filter(mel => mel != m)
      defaultBehaviour()
    } 
  })

  function elliPath(ell1, ell2) {
    var x1 = ell1.attr("cx"), y1 = ell1.attr("cy"), x2 = ell2.attr("cx"), y2 = ell2.attr("cy")
    , dx = x2-x1    , dy = y2-y1
    , dist = Math.sqrt(dx*dx + dy*dy)
    , xRatio = dx/dist, yRatio = dy/dist
    return ["M", x1 + ell1.attr("rx")*xRatio, y1 + ell1.attr("ry")*yRatio, "L", x2 - ell2.attr("rx")*xRatio, y2 - ell2.attr("ry")*yRatio].join(" ")
  }
              
  function drawGraphArrows() {  //(re-)dessin des flèches du graphe (à partir de gold.m.graph "pur"?)
    g.arrows=[]                               
    g.forEach((m, i) => {   
      m.rel.split('').forEach((c,j)=> {
        switch(c) { case 'p':; case 's': //ignore cases "m", "." and "e"
          var arrowNb = g.arrows.push({
            from: i, 
            to  : j,
            line: (l = g.ppr.path(elliPath(g[i].shapes.first(), g[j].shapes.first()))
              .stroke({width: 2})
              .stroke(c == "p" ? {color: '#000'} : {color: '#f06', dasharray: '5, 2'})
              .attr("marker-end", "url(#"+(c == "p"? "black": "red")+"Arrow")
          )})   
          if ($('#editeur')[0].checked) l.on('click', e => {   //***********************FSA d'interaction sur les flèches: 
            if (e.metaKey)
              if (e.target.getAttribute("stroke-width") == "5") { 
                showGraph(deleteRelation(g[i], g[j]))
                edited()
              }  
              else e.target.setAttribute("stroke-width","5")
            else e.target.setAttribute("stroke-width","2")
  })}})})}  

  function edited() { //makes sure this graph's changes are remembered and recorded by user
    drawGraphArrows()  //pouquoi??
    if (g.geoChanged)  return
    g.geoChanged = true
    var changed = graphs.map((g,i)=>g.geoChanged?i:0).filter(g=>g!=0).join()
    $('#saveBtn').text('enregistrer graphe'+(changed.length >2?'s ':' ')+ changed).click(saveGraph).show()
    function saveGraph() {
      updated_m_jsonFile=JSON.stringify(
        { refs: mels.map(m=>(Object.assign(
          {
            mel: m.mel,
            ds: m?.ds?.join(),
            titre: m.titre,
            music: m.music,
            mscz: m.mscz,
            commentaire: m.commentaire,
            //docs: m?.docs?.map(d=>d.ref).join()
            sxs: m?.sxs?.join(),
            mscz: m.mscz
          }, 
          m.f.f? {
            f: m.f.f,
            X: m.X, 
            Y: m.Y, 
            rel: m.rel
          }:{}))),
          prefix: 'm',
          name: 'Mélodies',
          core: '[0-9]{1,3}',
          suffix: ',m',
          media: '0,0',
          colldoc: '1XwAzAO4ltdPSggO5ZX38d9YiCJbL_h54OhtxDWd0D2c'
        }
      , null, "  ")
      console.log(updated_m_jsonFile)
      graphs.forEach(g =>g.geoChanged = false)
      $('#saveBtn').hide()
    }
  }
 
  function createRelation(from, to, sim) { //sim = opt boolean (not tested yet)
    var [e, p] = sim ? ['s', 's'] : ['e', 'p']
    function markRel(par, enf) {
      par.rel = par.rel.split('').with(enf.rel.indexOf("m"), e).join('')
      enf.rel = enf.rel.split('').with(par.rel.indexOf("m"), p).join('')
    }
    function grpSize(mel) { return mel.f.f ? mel.f.length : 1 }
    var newLength = grpSize(from) + grpSize(to);            // rallonge des rels
    (from.f.f ? from.f : [from]).forEach(m=>m.rel=m.rel.padStart(newLength, '.'));  // le groupe de "from" sera en début de dGrp (gauche des rel)
    (  to.f.f ? to.f   : [to]  ).forEach(m=>m.rel=m.rel.padEnd  (newLength, '.'));  // le groupe de  "to" sera en fin de dGrp (droite des rel)
    markRel(to, from) 
    if (from.f.f * to.f.f) {  // s'il y avait 2 vrais graphes, on place celui de "to" (parent) en haut à gauche
      offsetX = to.f.reduce((max, m) => Math.max(m.X, max), 0)
      offsetY = to.f.reduce((max, m) => Math.max(m.Y, max), 0)
      from.f.forEach(m=>{ m.X +=offsetX; m.Y +=offsetY })           
    }
    var dGrp = (to.f.f ? to.f :[to]).concat(from.f.f ? from.f : [from])
    var sGrp //source group :le plus petit des deux, qu'on va vider et jeter
    [dGrp.f, sGrp] = (gf=grpSize(from)) > (gt=grpSize(to)) ? [from.f.f, to.f] : 
         gf*gt==1 ? [newEmptyGraph([to, from]).f, graphs[0]] : [to.f.f, from.f]  // *****en examen pour les 3 cas où g0 intervient
    dGrp.forEach(m=> m.f = dGrp) // on màj les refs au graphe dans les mels 
    graphs[dGrp.f] = dGrp
    graphs[sGrp.f] = graphs[sGrp.f].filter(m=>!dGrp.includes(m)) //on nettoie (voire vide!) le petit graphe
    //console.log(dGrp.map(m=>[m.mel,m.rel]))
    return dGrp.f
  }

  function deleteRelation(from, to) {  // 'from' and 'to' are mel objects
    var g = from.f                     // same group as to.f (since one arrow joined them)
    var i = g.findIndex(m=>m==from)
    var j = g.findIndex(m=>m==to);  
    [i,j].forEach(k => g[k].rel=g[k].rel.split('').with(k==i ? j : i, '.').join(''))   // enlever cette relation ('p' 'e' ou 's')
    function relNorm(i) {return g[i].rel.replaceAll(/[pes]/g,'R')}     // par ex: "m..es.p" => "m..RR.R"
    var closures = relNorm(i)                                          // initialement, pour finir par ex en '.m.mmm....'
    while (closures.includes('R')) {
      function merge(a,b) {return a.split('').reduce ((acc, _, i) => acc + (a.charCodeAt(i)>b.charCodeAt(i) ? a[i] : b[i]),'')}
      closures = merge(closures, relNorm(closures.search('R')))
    } 
    if (closures.includes('.')) {                                      // case where 2 subgraphs are identified
      const closureKey = ['m', '.']
      closureKey.map(ch=> g.filter((_m, j)=> closures[j] == ch)).forEach((dG, j) => {
        dG.f = (l=dG.length)==1 ? 0  : l*2 > (cl=closures.length) ? g.f  : j ? g.f  : newEmptyGraph([]).f   // what group #?      
        if (dG.f) graphs[dG.f]= dG    //on écrase l'ancien graphe
        else {
            graphs[0].push(dG[0])               //il n'y a qu'1 mél dans ce sous-graphe, on la vire en g0
            graphs[0].sort((a,b)=>a.mel>b.mel)
            if (g.length == 2 && j) g.length=0  //  on vide le graphe d'origine
        }  
        dG.forEach(m=> {
          m.rel = m.rel.split('').filter((_, i)=>closures[i]==closureKey[j]).join('')
          m.f = graphs[dG.f]
    })})}
    return g.length ? g.f : 0  //le graphe à présenter
  }
}



