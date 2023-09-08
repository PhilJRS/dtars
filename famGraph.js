var graph = []
var curGraph //n'a de sens que si & seul graph est visible à la fois.
const elL = 60, elH = 40 //largeur et hauteur des ellipses

function initGraph() {
  gold.m.refs.filter(m=>m.graph).sort((a,b)=> a.mel-b.mel).forEach(m=>{  //liste triée de toutes les méls "en famille""
    g = m.graph.grp
    if(!graph[g]) graph[g]={ mels :[], ppr : undefined , rels : []}
    graph[g].mels[m.graph.rel.indexOf("m")] = m
  })

  graph.forEach((_g, f) => {  
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
          showGraph(f)
}})})}
 
function showGraph(f) { 
  if (f == null) {$('#fPaper').empty(); return}
  //f n'est donc PAS null
  if ($('#fPaper'+f).length) return //f est déjà affiché: laisse béton //test d'affichage de la famille f
  if ($('#fPaper').children(0).length) $('#fPaper').empty() 
  g = graph[f] 
  var graphWidth = elL + g.mels.reduce((max, m) => Math.max(m.graph.X, max), 0)
  var graphHeigth = elH + g.mels.reduce((max, m) => Math.max(m.graph.Y, max), 0)

  $('#fPaper')
    .width(graphWidth)
    .height(graphHeigth)
    .append($('<svg id="fPaper'+f+'"/>'))                       //mise en place du papier
 
  g.ppr2 = SVG().addTo('#fPaper')
  function elliPath(ell1, ell2) {
    var x1 = ell1.attr("cx"), y1 = ell1.attr("cy"), x2 = ell2.attr("cx"), y2 = ell2.attr("cy")
    , dx = x2-x1    , dy = y2-y1
    , dist = Math.sqrt(dx*dx + dy*dy)
    , xRatio = dx/dist, yRatio = dy/dist
    return ["M", x1 + ell1.attr("rx")*xRatio, y1 + ell1.attr("ry")*yRatio, "L", x2 - ell2.attr("rx")*xRatio, y2 - ell2.attr("ry")*yRatio].join(" ")
  }
  
  g.mels.forEach((m,i) =>{                                                       
    var group = g.ppr2.group()
    group.ellipse(elL, elH).stroke({color: '#000',width : 1}).fill(m.graph.rel.includes("p") ? "#d4e1f5" : "#FFF2CC"), // bleu, jaune 
    group.text(m.mel).font('size', 10).center(elL/2, elH/2)
    m.shapes = group.move(m.graph.X, m.graph.Y).attr({cursor: "move"})
  })
  g.mels.forEach((m, i, mels) => {                                          //dessin des flèches
    m.graph.rel.split('').forEach((c,j)=> {
      switch(c) { case 'p':; case 's': //ignore cases "m", "." and "e"
        g.rels.push({
          from: i, 
          to  : j,
          line: (g.ppr2.path(elliPath(mels[i].shapes.first(), mels[j].shapes.first())).stroke({width: 2})
            .stroke(c == "p" ? {color: '#000'} : {color: '#f06', dasharray: '5, 2'})
            .attr("marker-end", "url(#"+(c == "p"? "black": "red")+"Arrow")
  )})}})})
  g.mels.forEach((m, i, mels) => {
    function arrUpdate() { g.rels.filter(c=> c.from==i || c.to ==i).forEach(c =>     //redessine les flèches concernées
        c.line.plot(elliPath(mels[c.from].shapes.first(), mels[c.to].shapes.first()))
    )}
    m.shapes    //système d'animation:
    .click(()=>showMel(m.mel))                                       
    .touchstart(()=>showMel(m.mel))                                       
    .draggable()
      .on('dragmove', e=> arrUpdate())
      .on('dragend', e=> { arrUpdate(); m.graph.X = e.detail.box.x; m.graph.Y = e.detail.box.y})
    }
  )
}

//JSON.stringify(graph.map(g=>g.mels.map(m=>({mel : m.mel, X : m.graph.X, Y:m.graph.Y, rel:m.graph.rel}))))