var curGraph //n'a de sens que si 1 seul graph est visible à la fois.
const elL = 60, elH = 40 //largeur et hauteur des ellipses


var selArr =[]
var selSvgGrp, firstMelforRel, oldFirstMelForRelFill 

function stringMark(rel, index, char) { 
  var arr=rel.split('')
  arr.splice(index,1,char); 
  return arr.join('')
}

function initGraph() {  //il faut une version qui construit maintenant graphs à partir de mels
  gold.m.graphs.forEach((g, i) => g.forEach(m => {
    m.grp = g
    gold.m.refs[m.mel].graph = m  
  }))
  gold.m.graphs.forEach((g, f) => {
    g.f=f
    //nettoyage des vieux "e"
    if (f) { //ne rien faire avec le graphe 0
      g.forEach(m=>m.rel = m.rel.replaceAll('e','.'))
      //replace les "e" en réciproques de chaque "p") 
      g.forEach((m,i)=> m.rel.split('').forEach((r,j)=>{
        if(r=='p') g[j].rel = stringMark(g[j].rel, i, 'e')
      }))
    }
    makeDTfamBttns(f)
  }
)}

function clearGraph(f) {
  gold.m.graphs[f]=[]
  if (gold.m.graphs.length == f+1) {
    document.querySelector('#fBt'+f).remove()
    gold.m.graphs.length--
  }
}

function makeDTfamBttns(f) {
  $('#DTfamBttns').append($('<button id="fBt'+f+'"/>').text(f))
  document.querySelector('#fBt'+f).addEventListener('click', function() {
      if (curGraph != null) document.querySelector('#fBt'+curGraph).style.backgroundColor = "#ccc"  //reset du bouton actif
      if (curGraph == f) {
        $('#fPaper').empty().height("0px")
        curGraph = null
      } else {
        curGraph = f
        document.querySelector('#fBt'+curGraph).style.backgroundColor = 'lightgreen';
        $('#fPaper').empty()
        $('#audio')[0].pause()
        showGraph(f)
}})}

function newEmptyGroupNb() { //returns number of new (or recycled) empty group 
  var n = gold.m.graphs.findIndex((g,i)=>i && g.length==0) //no empty group to recycle
  if (n == -1) {
    n = gold.m.graphs.push([])-1
    gold.m.graphs[n].f=n
    makeDTfamBttns(n)
  }
  return n
}
 

function showGraph(f) {   //f est un n°
  if (f == null) {$('#fPaper').empty(); return}
  if ($('#fPaper').children(0).length) $('#fPaper').empty()
  curGraph = f
  var g = gold.m.graphs[f]
  if (f==0) {  
    //On "calcule" de fait le graphe [0]
    //en rangeant les m dans un carré de "units" unités de côté
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
  $('#fPaper')
    .width(graphWidth)
    .height(graphHeigth)
    .attr("fam",f)
 
  g.ppr = SVG().addTo('#fPaper')
  function elliPath(ell1, ell2) {
    var x1 = ell1.attr("cx"), y1 = ell1.attr("cy"), x2 = ell2.attr("cx"), y2 = ell2.attr("cy")
    , dx = x2-x1    , dy = y2-y1
    , dist = Math.sqrt(dx*dx + dy*dy)
    , xRatio = dx/dist, yRatio = dy/dist
    return ["M", x1 + ell1.attr("rx")*xRatio, y1 + ell1.attr("ry")*yRatio, "L", x2 - ell2.attr("rx")*xRatio, y2 - ell2.attr("ry")*yRatio].join(" ")
  }
  
  g.forEach((m,i) => {   //on dessine chaque mélodie, et renseigne l'attribut m.shape                                                    
    var group = g.ppr.group()
    group.id ("m"+m.mel)
    group.ellipse(elL, elH).stroke({color: '#000',width : 1}).fill(m.rel.includes("p") ? "#d4e1f5" : "#FFF2CC"), // bleu, jaune 
    group.text(m.mel).font('size', 10).center(elL/2, elH/3)
    var rsRef = gold.m.refs[m.mel]?.docs?.find(d=>d.ref.startsWith('RS'))?.ref
    if (rsRef) group.text(rsRef).font('size', 9).center(elL/2, elH*2/3)
    m.shapes = group.move(m.X, m.Y)
  })
                  
  function drawGraphArrows() {  //(re-)dessin des flèches du graphe (à partir de gold.m.graph "pur"?)
    g.rels=[]                               
    g.forEach((m, i) => { 
      m.rel.split('').forEach((c,j)=> {
        switch(c) { case 'p':; case 's': //ignore cases "m", "." and "e"
          var arrowNb = g.rels.push({
            from: i, 
            to  : j,
            line: (l = g.ppr.path(elliPath(g[i].shapes.first(), g[j].shapes.first()))
              .stroke({width: 2})
              .stroke(c == "p" ? {color: '#000'} : {color: '#f06', dasharray: '5, 2'})
              .attr("marker-end", "url(#"+(c == "p"? "black": "red")+"Arrow")
            )
          })
          if ($('#editeur')[0].checked) l.on('click', e => {   //***********************FSA d'interaction sur les flèches: 
            if (e.metaKey)
              if (e.target.getAttribute("stroke-width") == "5") {
                e.target.remove();
                g.rels.splice(arrowNb,1) //removes corresponding arrow line from rels
                if (g.length == 2) {  //fini, vidons le graphe :
                  g0=gold.m.graphs[0];
                  [i,j].forEach(k=> {
                    g[k].grp=g0
                    g0.push(g[k])
                  })
                  g0.sort((a,b)=>a.mel>b.mel)
                  clearGraph(g.f)
                  showGraph(0)
                } else { //at least 3 mels here
                  [i,j].forEach(k => g[k].rel=stringMark(g[k].rel, k==i?j:i, '.')) //effacer le marquage de cette relation ('p' 'e' ou 's')
                  var part=parting(i)
                  if (part.length) { // extract new graph
                    //console.log(`${part.join()} parting from`)
                    //console.log(g.map(m=>[m.mel,m.rel])) 
                    g.forEach((m, i)=>{  //pour chaque ligne du vieux graphe
                      var part_includes_i = part.includes(i)
                      var r =''
                      m.rel.split('').forEach((c,j)=> {  //pour chaque caractère de cette ligne
                        var part_includes_j = part.includes(j)
                        r= part_includes_i ? part_includes_j?r+c:r : part_includes_j?r:r+c 
                      })
                      m.rel=r
                    })
                    var nG = gold.m.graphs[nGnb = newEmptyGroupNb()]
                    part.forEach(m => nG.push(g[m]))
                    part.reverse().forEach(m => g.splice(m,1))  //reverse ordered, or else it gets messy!!
                    //console.log(g.map(m=>[m.mel,m.rel])) 
                    //console.log(nG.map(m=>[m.mel,m.rel]))
                  }        
                  showGraph(f)

                  function parting (i) { // i is in a (new) parting group if closure of i doesn't contain j
                    var closure = new Set(immediateClosure(i))
                    var examined=new Set([i])
                    do for (const m of closure) if (!examined.has(m)) {
                          immediateClosure(m).forEach(n=>closure.add(n))
                          examined.add(m)
                    } while ((examined.length != closure.length) ||  closure.has(j))
                    if (closure.has(j)) return []
                  
                    if (closure.length*2 > g.length)  //c'est le + petit sous-groupe qui doit partir
                        closure = g.map((m,i)=>i).filter(i=>closure.has(i))
                    return (Array.from(closure)).sort();

                    function immediateClosure(i) {
                      return g[i].rel.split('').reduce((acc, m, n) => 'pes'.includes(m) ? acc.concat(n) : acc , [])
                    }
                  }
                }
                edited()
                }
              else e.target.setAttribute("stroke-width","5")
            else e.target.setAttribute("stroke-width","2")
          })
  }})})}
  drawGraphArrows()
  selSvgGrp = g.ppr.group()

  
  function edited() { //makes sure this graph's changes are remembered and recorded by user
    if (g.geoChanged)  return
    g.geoChanged = true
    var changed = gold.m.graphs.map((g,i)=>g.geoChanged?i:0).filter(g=>g!=0).join()
    $('#saveBtn').text('enregistrer graphe'+(changed.length >2?'s ':' ')+ changed).click(saveGraph).show()
    function saveGraph() {
      updates=JSON.stringify(
        //gold.m.graphs.map(g=>g.map(m=>({mel: m.mel, X: m.X, Y: m.Y, rel: m.rel})))
        gold.m.refs.map(m=>({
          mel: m.mel,
          ds: m?.ds?.join(),
          titre: m.titre,
          music: m.music,
          mscz: m.mscz,
          commentaire: m.commentaire,
          sxs: m?.sxs?.join(),
          mscz: m.mscz,
          f: m.graph.f,
          X: m.X, 
          Y: m.Y, 
          rel: m.rel //,
          //docs: m?.docs?.map(d=>d.ref).join()
        }))
        //gold.m.refs.
        , null, "  ")
      console.log(updates)
      gold.m.graphs.forEach(g =>g.geoChanged = false)
      $('#saveBtn').hide()
    }
  }

  
  g.forEach((m, i) => {    //***********************FSA d'interaction sur les ellipses: 
    m.shapes.first().on('click', $('#editeur')[0].checked ? e=>defaultEditorsClick(e) :  toggleMel)

    function defaultEditorsClick(e) {
      if (e.shiftKey && e.metaKey) return console.log('ignored "shift + meta" click')
      if (e.shiftKey) {  //on veut draguer (1 mél ou +, à voir)
        if(selArr.length ==0 ) $('#audio')[0].pause()  //on fait silence pour l'édition!
        if(selArr.includes(m)) 
            unselectFromDrag(m)   //il shift-key 2 fois la même mélodie: on l'enlève
        else  selectForDrag(m)    // cette mélodie n'est pas déjà dans le groupe de drague
      }    
      else {// no shift key 
        if (selArr.length)  unselectAllFromDrag(e)
        else if (e.metaKey) {  //on ajoute une relation
            if (firstMelforRel) {  //on vient de sélectionner la 2e mélodie
              if (firstMelforRel!=m) {
                setRel(firstMelforRel, m)
                //console.log(`from m${m.mel} to m${firstMelforRel.mel} in`)
                //console.log(g.map(m=>[m.mel,m.rel]))
                edited()
              }
              unselectFromRel()
            }else {
              firstMelforRel=m
              oldFirstMelForRelFill= m.shapes.first().fill()
              m.shapes.first().fill('#00ff00')
              //console.log(`Sélectionner une autre mélodie à relier à m${m.mel}`)
            }
          } else if (firstMelforRel) unselectFromRel()
                  else toggleMel()
      }
    }

    function toggleMel() {
      var audio = $("#audio")
      if (audio.attr("mel") != m.mel) {
        audio[0].pause()
        audio.attr("src", null)
        $('#titre').text("")
        return showMelPanel(m.mel)
      }
      audio[0].paused ? audio[0].play() : audio[0].pause()
    }

    function setRel(enf, par, sim) { //prérequis: même graphe!  //sim = opt boolean (not tested yet)
      var e ='e', p ='p'
      if (sim) { e = 's'; p = 's'}
      var pGrp = par.grp, eGrp = enf.grp
      if (pGrp == eGrp) { 
        if (pGrp == gold.m.graphs[0]) {  //CAS 1: il sont tous deux célibataires, il faut faire une nouvelle famille
            var dGrpNb = newEmptyGroupNb()
            var dGrp = gold.m.graphs[dGrpNb];
            [par,enf].forEach(mel => {
              gold.m.graphs[0] = gold.m.graphs[0].filter(m=>m!=mel)
              gold.m.refs[mel.mel].graph.grp = dGrp
            })
            dGrp.push(par.graph = { mel: par.mel, X: 60, Y:  30, rel: "me", grp:dGrp })
            dGrp.push(enf.graph = { mel: enf.mel, X: 80, Y: 100, rel: "pm", grp:dGrp })
            gold.m.graphs[0] = gold.m.graphs[0].filter(m=>![par.mel,enf.mel].includes(m.mel))
            showGraph(dGrpNb)

        } 
        else {   //CAS 2: simple màj de la table des rels du graphe
          par.rel = stringMark(par.rel, enf.rel.indexOf("m"), e )
          enf.rel = stringMark(enf.rel, par.rel.indexOf("m"), p )
        }
      } 
      else if (pGrp == gold.m.graphs[0] || eGrp == gold.m.graphs[0]) { //CAS 3 , faut rattacher la mélodie solitaire mS à la famille f
          //anonymisation des mélodies : SOLitaire (avant) ou GREgaire et du groupe de Destination
        var [sol, gre, dGrp] = (pGrp == gold.m.graphs[0]) ?  [par,enf, eGrp] : [enf, par, pGrp]
        gold.m.graphs[0].splice(gold.m.graphs[0].findIndex(i=>i.mel == sol.mel), 1) //on sort le solitaire de sa liste du graph[0]
        gold.m.refs[sol.mel].graph.grp = dGrp
        var j = gre.rel.indexOf('m') //position de gre dans son groupe (Destination de sol)
        dGrp.forEach((m,i) => m.rel += (i==j?(gre==par? 'e':'p'):'.')) //on rallonge chaque ligne du groupe
        dGrp.push(sol.graph = {                                  //on ajoute la nouvelle ligne})
            mel: sol.mel, X: 60 + (Math.floor(Math.random() *30)), Y: 30+ (Math.floor(Math.random() *30)),
            rel: ('.'.repeat(j) + (gre==par ? 'p' : 'e')).padEnd(dGrp.length, '.') + 'm' 
        })
        showGraph(gold.m.graphs.findIndex(g=>g==dGrp))
        //console.log(dGrp)
      } else {            /*  CAS 4 : 2 vraies familles à merger! conventions: 
                                            1) on garde la famille la plus nombreuse)
                                            2) on met le parent en haut à gauche, l'enfant en bas à droite*/
        //step 1) màj des rels du graphe "parent"
        var newLength = pGrp.length + eGrp.length 
        //step 2) màj des rels, X et Y du graphe "enfant"
        pGrp.forEach(m=>m.rel=m.rel.padEnd(newLength, '.'))  
        offsetX = pGrp.reduce((max, m) => Math.max(m.X, max), 0)
        offsetY = pGrp.reduce((max, m) => Math.max(m.Y, max), 0)
        eGrp.forEach(m=>{
            m.X +=offsetX
            m.Y +=offsetY
            m.rel =  m.rel.padStart(newLength, '.')
        })
        par.rel = stringMark(par.rel, enf.rel.indexOf("m"), e )
        enf.rel = stringMark(enf.rel, par.rel.indexOf("m"), p )
        //step 2) on ajoute le plus petit graphe au plus grand  

        var pGrpN = gold.m.graphs.indexOf(pGrp) //on s'en passera dès que le Graph sera de nouveau un numéro
        var eGrpN = gold.m.graphs.indexOf(eGrp)
        var [big, small] = pGrp.length > eGrp.length ? [pGrpN, eGrpN] : [eGrpN, pGrpN]
        gold.m.graphs[big] = pGrp.concat(eGrp)
        gold.m.graphs[small] = []
        //console.log(gold.m.graphs[big].map(m=>[m.mel,m.rel]))
        showGraph(big)
      }
    }

    function unselectFromRel() {
      firstMelforRel.shapes.first().fill(oldFirstMelForRelFill)
      firstMelforRel = undefined
      defaultBehaviour(m)
    }
    
    function moveArrows() {
      g.rels.filter(c=> c.from==i || c.to ==i).forEach(c =>     //redessine les flèches concernées
        c.line.plot(elliPath(g[c.from].shapes.first(), g[c.to].shapes.first()))
    )}

    function defaultBehaviour(m) {
      m.shapes.first()    
      .click(toggleMel)
      .touchstart(toggleMel)
    }
    function selectForDrag(m) { 
      selArr.push(m)            
        m.shapes.first().stroke({width:5})
        selSvgGrp.add(m.shapes)
        selSvgGrp.draggable()
          .on('dragmove', ()=>   moveArrows() )
          .on('dragend' , ()=> { 
            moveArrows()
            selArr.forEach(m=>{
              [m.X, m.Y] = [m.shapes.first().x(), m.shapes.first().y()]
              //m.shapes.click(unselectFromDrag(m))
            })
            edited()
          }
    )}
    function unselectAllFromDrag(e) { 
      if (selArr.length==0) return    
      selSvgGrp.draggable(false)//on arrête le groupe : faut enregistrer
      selSvgGrp.off()
      selArr.forEach(m=>unselectFromDrag(m))
      selArr =[]  //useless?
      defaultEditorsClick(e)
    }
    function unselectFromDrag(m) { 
      g.ppr.add(m.shapes)
      m.shapes.first().stroke({width:1})
      selArr = selArr.filter(mel => mel != m)
      defaultBehaviour(m)
    } 
  })
}
