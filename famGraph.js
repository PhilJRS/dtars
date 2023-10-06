var graph = [{ mels :[], rels : []}] // le premier graphe est vide:[]
var curGraph //n'a de sens que si 1 seul graph est visible à la fois.
const elL = 60, elH = 40 //largeur et hauteur des ellipses

var selectedGroup =[]
var selGrp

function stringMark(rel, index, char) { 
  var arr=rel.split('')
  arr.splice(index,1,char); 
  return arr.join('')
}

function initGraph() {  // construit le tableau des graphes à partir de celui des références dans m
  gold.m.refs.filter(m=>m.graph).sort((a,b)=> a.mel-b.mel).forEach(m=>{  //liste triée de toutes les méls "en famille""
    g = m.graph.grp  //numéro de graphe (ou de famille)
    if(!graph[g]) graph[g]={ mels :[], rels : []}
    if (g) graph[g].mels[m.graph.rel.indexOf("m")] = m
    else graph[0].mels.push(m) //pas de relations dans le pseudo-graphe 0
  })

  $('#saveBtn').click(() =>{
    updates=JSON.stringify(graph.map(g=>(g.mels? g.mels.map(m=>({mel : m.mel, X : m.graph.X, Y:m.graph.Y, rel:m.graph.rel})):[])), null, "  ")
    console.log(updates) 
  })

  graph.forEach((g, f) => {
    //nettoyage des vieux "e"
    g.mels.forEach(m=>m.graph.rel = m.graph.rel.replaceAll('e','.'))
    //replace les "e" en réciproques de chaque "p") 
    g.mels.forEach((m,i)=> m.graph.rel.split('').forEach((r,j)=>{
      if(r=='p') g.mels[j].graph.rel = stringMark(g.mels[j].graph.rel, i, 'e')
    }))

    if (f==0) return //ne rien faire avec le graphe 0
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
}})})}
 
function showGraph(f) { 
  if (f == null) {$('#fPaper').empty(); return}
  //f n'est donc PAS null
  //if ($('#fPaper'+f).length) return //f est déjà affiché: laisse béton
  if ($('#fPaper').children(0).length) $('#fPaper').empty() 
  g = graph[f]
  curGraph = f

  var minX = g.mels.reduce((min, m) => Math.min(m.graph.X, min), 10000) - elL
  var minY = g.mels.reduce((min, m) => Math.min(m.graph.Y, min), 10000) - elH
  g.mels.forEach(m => {m.graph.X-=minX; m.graph.Y-=minY})

  var graphWidth = elL + g.mels.reduce((max, m) => Math.max(m.graph.X, max), 0)
  var graphHeigth = elH + g.mels.reduce((max, m) => Math.max(m.graph.Y, max), 0)

  $('#fPaper')
    .width(graphWidth)
    .height(graphHeigth)
    //.append($('<svg id="fPaper'+f+'"/>'))                       //mise en place du papier
 
  g.ppr = SVG().addTo('#fPaper')
  function elliPath(ell1, ell2) {
    var x1 = ell1.attr("cx"), y1 = ell1.attr("cy"), x2 = ell2.attr("cx"), y2 = ell2.attr("cy")
    , dx = x2-x1    , dy = y2-y1
    , dist = Math.sqrt(dx*dx + dy*dy)
    , xRatio = dx/dist, yRatio = dy/dist
    return ["M", x1 + ell1.attr("rx")*xRatio, y1 + ell1.attr("ry")*yRatio, "L", x2 - ell2.attr("rx")*xRatio, y2 - ell2.attr("ry")*yRatio].join(" ")
  }
  selGrp = g.ppr.group()
  g.mels.forEach((m,i) =>{                                                       
    var group = g.ppr.group()
    group.ellipse(elL, elH).stroke({color: '#000',width : 1}).fill(m.graph.rel.includes("p") ? "#d4e1f5" : "#FFF2CC"), // bleu, jaune 
    group.text(m.mel).font('size', 10).center(elL/2, elH/3)
    var rsRef = m?.docs?.find(d=>d.ref.startsWith('RS'))?.ref
    if (rsRef) group.text(rsRef).font('size', 9).center(elL/2, elH*2/3)
    m.shapes = group.move(m.graph.X, m.graph.Y)
  })

  
  g.rels=[]
  g.mels.forEach((m, i, mels) => {                                          //dessin des flèches
    m.graph.rel.split('').forEach((c,j)=> {
      switch(c) { case 'p':; case 's': //ignore cases "m", "." and "e"
        g.rels.push({
          from: i, 
          to  : j,
          line: (g.ppr.path(elliPath(mels[i].shapes.first(), mels[j].shapes.first())).stroke({width: 2})
            .stroke(c == "p" ? {color: '#000'} : {color: '#f06', dasharray: '5, 2'})
            .attr("marker-end", "url(#"+(c == "p"? "black": "red")+"Arrow")
            .on('click', e => {
              if (e.metaKey)
                if (e.target.getAttribute("stroke-width") == "5") {
                  e.target.remove();
                  ([i,j]).forEach(k => {                                               //effacer la flèche
                    g.mels[k].graph.rel=stringMark(g.mels[k].graph.rel, k==i?j:i, '.') //enlever 'p' et 'e'
                    if (g.mels[k].graph.rel.replaceAll('.','').length==1) {            //s'il n'a plus de relation dans la famille
                      g.mels.forEach(m=>m.graph.rel = stringMark(m.graph.rel,k ,''))   //mettre les autres rel de la famille à jour
                      g.mels[k].graph = undefined                                      //jeter l'objet graphe
                      g.mels.splice(k,1)                                               //jeter la ligne dans la collection g.mels
                }})}
                else e.target.setAttribute("stroke-width","5")
              else e.target.setAttribute("stroke-width","2")
            })
  )})}})})
 

  g.mels.forEach((m, i, mels) => {

    function moveArrows() {
      g.rels.filter(c=> c.from==i || c.to ==i).forEach(c =>     //redessine les flèches concernées
        c.line.plot(elliPath(mels[c.from].shapes.first(), mels[c.to].shapes.first()))
    )}

    function toggleMel() { 
      if (curMelNb != m.mel) return showMel(m.mel)
      d=$('#audio')[0]
      return (d.paused? d.play() : d.pause())
    }
    
    //système d'animation:
  
    if ($('#editeur')[0].checked) {
      function exclude(m) { 
        m.shapes.first().stroke({width:1})
        g.ppr.add(m.shapes)
      } 
      m.shapes.first().on('click', e=> {
          if (e.shiftKey) {  //on veut dragger (1 mél ou +, à voir)
            $('#audio')[0].pause()
            if(!selectedGroup.includes(m)) {    // cette mélodie n'est pas déjà dans le groupe de drague
              selectedGroup.push(m)            
              m.shapes.first().stroke({width:5})
              selGrp.add(m.shapes)
              selGrp.draggable()
                .on('dragmove', ()=>   moveArrows() )
                .on('dragend' , ()=> { moveArrows()
                  selectedGroup.forEach(m=>[m.graph.X, m.graph.Y] = [m.shapes.first().x(), m.shapes.first().y()])
                  graph[f].geoChanged = true
                  var changed = graph.map((g,i)=>g.geoChanged?i:0).filter(g=>g!=0).join()
                  $('#saveBtn').text('enregistrer graphe'+(changed.length >2?'s ':' ')+ changed).click(saveGraph)
                })
            } //else exclude(m)    //fails      //il shift-key 2 fois la même mélodie: on l'enlève
          } else // no shift key 
              if (selectedGroup.length)  {    //on arrête le groupe : faut enregistrer
                selGrp.draggable(false)
                selGrp.off()
                selectedGroup.forEach(m=>exclude(m))
                selectedGroup =[]
              } else if (e.metaKey) {  //on ajoute une relation (+ une grappe?)
                null
                null
              //approche provisoire à la console:
              function uses(melP){
                //addParent(m.)
              }
              function usedBy(melE){
              }
              var x =1/0 //pour planter et lancer le débugger!

                /*sol1:
                //$('#DTfamBttns').append($('<button id="sbop"/>').text("p..., e..., s... ou a pour abandon"))
                //sol2:
                  g.ppr.rect(400,40).fill("#fff2cc")
                  g.ppr.text("p..., e..., s... ou a pour abandon").font({
                    size: 14,
                    family: 'Menlo, sans-serif',
                    fill: '#aafaaa'
                  })*/
              } else toggleMel()
        })
    } else 
      m.shapes.first()    
        .click(toggleMel)
        .touchstart(toggleMel)
    }
  )
}

function saveGraph() {
  updates=JSON.stringify(graph.map(g=>(g.mels? g.mels.map(m=>({mel : m.mel, X : m.graph.X, Y:m.graph.Y, rel:m.graph.rel})):[])), null, "  ")
  console.log(updates)
  graph.forEach(g =>g.geoChanged = false)
  $('#saveBtn').hide()
}

function utilise(m1, m2) {


}
